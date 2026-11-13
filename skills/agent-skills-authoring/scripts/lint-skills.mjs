#!/usr/bin/env node
// lint-skills.mjs — checks a folder of agent skills for drift.
//
//   node <this skill>/scripts/lint-skills.mjs [skills-dir]
//
// skills-dir defaults to the folder that holds this skill (the other skills are its siblings), so it
// works wherever the skills are installed: a repo's .agents/skills, ~/.claude/skills, a package.
//
// Exit 1 when any error is found; warnings don't fail. No dependencies; Linux, macOS and Windows.
//
// Kinds of skill:
//   team      — written by the team: no UPSTREAM.md, or an UPSTREAM.md that says it absorbed upstream material
//   vendored  — an upstream skill kept unchanged, with LICENSE and UPSTREAM.md; only its frontmatter,
//               LICENSE, UPSTREAM.md and line endings are checked, never its content
//
// Checks:
//   frontmatter   name equals the folder, lower-case-hyphen, at most 64 chars; description present, at
//                 most 1024 chars; team skills also carry license, metadata.author and metadata.version
//   license       every skill has a LICENSE file
//   upstream      every vendored skill's UPSTREAM.md names a source URL and a pinned commit
//   links         relative links in a team skill's markdown point to files that exist, and #anchors to
//                 headings that exist (code blocks are skipped)
//   rules         rule files (rules/<id>.md) have title, impact, tags and check; IDs are unique across
//                 skills; each is linked from its skill's SKILL.md; its prefix is registered in
//                 agent-skills-authoring references/rule-prefixes.md
//   routed        every skill is named by some other team skill (no orphans)
//   eol           no CRLF line endings in any text file
//   portable      team skills name no install location (no path into a skills folder such as
//                 <dot-folder>/skills/<name>); files are relative to the skill, other skills are named
//   private       no line in any skill matches SKILLS_INTERNAL_PATTERNS (a regex of the organisation's own
//                 names, given in the environment, never in the skills); private IPv4 addresses warn
//
//   SKILLS_INTERNAL_PATTERNS='acme|corp\.example|cluster-a' node <this skill>/scripts/lint-skills.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || path.join(here, "..", ".."));

const errors = [];
const warnings = [];
const rel = (p) => path.relative(process.cwd(), p).split(path.sep).join("/");
const err = (file, line, check, msg) => errors.push(`${rel(file)}${line ? ":" + line : ""}: [${check}] ${msg}`);
const warn = (file, line, check, msg) => warnings.push(`${rel(file)}${line ? ":" + line : ""}: [${check}] ${msg}`);

const read = (p) => fs.readFileSync(p, "utf8");
const exists = (p) => fs.existsSync(p);
const TEXT = /\.(md|mjs|js|cjs|ts|sh|py|json|ya?ml|txt|bats)$|^(LICENSE|SKILL\.md|post-checkout|worktreeinclude)$/;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Minimal YAML frontmatter reader: top-level scalars and one level of nested scalars.
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const fm = {};
  let parent = null;
  for (const line of m[1].split(/\r?\n/)) {
    const top = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    const nested = line.match(/^\s{2,}([A-Za-z][\w-]*):\s*(.*)$/);
    const unq = (v) => v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (top) {
      parent = top[1];
      fm[parent] = top[2] === "" ? {} : unq(top[2]);
    } else if (nested && parent && typeof fm[parent] === "object") {
      fm[parent][nested[1]] = unq(nested[2]);
    }
  }
  return { fm, lines: m[0].split("\n").length - 1 };
}

// GitHub-style heading anchors.
function anchors(text) {
  const set = new Set();
  const seen = {};
  let fence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    const h = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!h) continue;
    let slug = h[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    if (seen[slug] !== undefined) {
      seen[slug]++;
      set.add(`${slug}-${seen[slug]}`);
    } else {
      seen[slug] = 0;
      set.add(slug);
    }
  }
  return set;
}

const skills = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const kind = {};
for (const s of skills) {
  const up = path.join(root, s, "UPSTREAM.md");
  kind[s] = !exists(up) ? "team" : /absorbed/i.test(read(up)) ? "team" : "vendored";
}

// --- per skill: frontmatter, license, upstream, eol
for (const s of skills) {
  const dir = path.join(root, s);
  const skillMd = path.join(dir, "SKILL.md");
  if (!exists(skillMd)) {
    err(dir, 0, "frontmatter", "no SKILL.md");
    continue;
  }
  const parsed = frontmatter(read(skillMd));
  if (!parsed) {
    err(skillMd, 1, "frontmatter", "no YAML frontmatter");
  } else {
    const { fm } = parsed;
    if (fm.name !== s) err(skillMd, 2, "frontmatter", `name '${fm.name}' differs from the folder '${s}'`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || s.length > 64) err(skillMd, 2, "frontmatter", "name must be lower-case words joined by hyphens, at most 64 chars");
    const d = typeof fm.description === "string" ? fm.description : "";
    if (!d) err(skillMd, 3, "frontmatter", "no description");
    else if (d.length > 1024) err(skillMd, 3, "frontmatter", `description is ${d.length} chars (max 1024)`);
    if (kind[s] === "team") {
      if (!fm.license) err(skillMd, 0, "frontmatter", "team skill without license");
      if (typeof fm.metadata !== "object" || !fm.metadata.author || !fm.metadata.version) err(skillMd, 0, "frontmatter", "team skill without metadata.author and metadata.version");
    }
  }
  if (!exists(path.join(dir, "LICENSE"))) err(dir, 0, "license", "no LICENSE file");
  if (kind[s] === "vendored") {
    const up = read(path.join(dir, "UPSTREAM.md"));
    if (!/https?:\/\//.test(up)) err(path.join(dir, "UPSTREAM.md"), 0, "upstream", "no source URL");
    if (!/\b[0-9a-f]{7,40}\b/.test(up)) err(path.join(dir, "UPSTREAM.md"), 0, "upstream", "no pinned commit");
  }
  for (const f of walk(dir)) {
    if (!TEXT.test(path.basename(f))) continue;
    const buf = fs.readFileSync(f);
    const i = buf.indexOf("\r\n");
    if (i >= 0) err(f, buf.subarray(0, i).toString().split("\n").length, "eol", "CRLF line ending");
  }
}

// --- links in team skills
const anchorCache = new Map();
const anchorsOf = (p) => {
  if (!anchorCache.has(p)) anchorCache.set(p, anchors(read(p)));
  return anchorCache.get(p);
};
for (const s of skills.filter((s) => kind[s] === "team")) {
  for (const f of walk(path.join(root, s)).filter((f) => f.endsWith(".md"))) {
    const lines = read(f).split(/\r?\n/);
    let fence = false;
    lines.forEach((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (fence) return;
      const noCode = line.replace(/`[^`]*`/g, "");
      for (const m of noCode.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const target = m[1];
        if (/^(https?:|mailto:|tel:)/.test(target)) continue;
        const [p, anchor] = target.split("#");
        const dest = p ? path.resolve(path.dirname(f), decodeURIComponent(p)) : f;
        if (!exists(dest)) {
          err(f, i + 1, "links", `broken link ${target}`);
          continue;
        }
        if (anchor && dest.endsWith(".md") && !anchorsOf(dest).has(anchor.toLowerCase())) err(f, i + 1, "links", `no heading for #${anchor} in ${rel(dest)}`);
      }
    });
  }
}

// --- rules
const prefixFile = path.join(root, "agent-skills-authoring", "references", "rule-prefixes.md");
const prefixText = exists(prefixFile) ? read(prefixFile) : "";
const ruleOwner = {};
const IMPACT = /^(CRITICAL|HIGH|MEDIUM-HIGH|MEDIUM|LOW)$/;
for (const s of skills.filter((s) => kind[s] === "team")) {
  const rdir = path.join(root, s, "rules");
  if (!exists(rdir)) continue;
  const skillText = read(path.join(root, s, "SKILL.md"));
  for (const name of fs.readdirSync(rdir).filter((n) => n.endsWith(".md") && !n.startsWith("_"))) {
    const id = name.slice(0, -3);
    const f = path.join(rdir, name);
    if (ruleOwner[id]) err(f, 0, "rules", `rule ID ${id} also in ${ruleOwner[id]}`);
    ruleOwner[id] = s;
    const parsed = frontmatter(read(f));
    if (!parsed) err(f, 1, "rules", "no frontmatter");
    else {
      for (const k of ["title", "impact", "tags", "check"]) if (!parsed.fm[k]) err(f, 1, "rules", `no ${k}`);
      if (parsed.fm.impact && !IMPACT.test(parsed.fm.impact)) err(f, 1, "rules", `impact '${parsed.fm.impact}' is not CRITICAL, HIGH, MEDIUM or LOW`);
    }
    if (!skillText.includes(`rules/${name}`)) err(path.join(root, s, "SKILL.md"), 0, "rules", `rule ${id} is not in the Rules index`);
    const prefix = id.split("-")[0] + "-";
    if (prefixText && !prefixText.includes("`" + prefix) && !prefixText.includes(" " + prefix)) warn(f, 0, "rules", `prefix ${prefix} not in agent-skills-authoring references/rule-prefixes.md`);
  }
}

// --- routed: every skill is named by another team skill
const teamText = skills
  .filter((s) => kind[s] === "team")
  .map((s) => ({ s, text: walk(path.join(root, s)).filter((f) => f.endsWith(".md")).map(read).join("\n") }));
for (const s of skills) {
  const re = new RegExp(`(^|[^a-z0-9-])${s.replace(/-/g, "\\-")}([^a-z0-9-]|$)`);
  if (!teamText.some((t) => t.s !== s && re.test(t.text))) err(path.join(root, s, "SKILL.md"), 0, "routed", `no other team skill names ${s}`);
}

// --- portable: no hard-coded install location in team skills
{
  const hard = /(^|[^\w.])(\.agents|\.claude|\.forge|\.codex|\.opencode)\/(skills|scripts)\/[A-Za-z<]/;
  for (const s of skills.filter((s) => kind[s] === "team")) {
    for (const f of walk(path.join(root, s))) {
      if (!TEXT.test(path.basename(f))) continue;
      read(f)
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (hard.test(line)) err(f, i + 1, "portable", "path into an install location: use a path relative to the skill, or name the other skill");
        });
    }
  }
}

// --- private: nothing internal in any skill (team or vendored), checked before publishing.
// SKILLS_INTERNAL_PATTERNS is a case-insensitive regex of the organisation's own names (projects,
// hosts, domains, clusters, customers), kept outside the skills, e.g. in the CI variables.
// Private IPv4 ranges are always flagged; RFC 5737 documentation ranges and loopback are not.
{
  const names = process.env.SKILLS_INTERNAL_PATTERNS ? new RegExp(process.env.SKILLS_INTERNAL_PATTERNS, "i") : null;
  const privateIP = /\b(10\.\d{1,3}|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/;
  const docs = /^(10\.0\.0\.|10\.0\.1\.|10\.20\.0\.)/; // example addresses the skills use on purpose
  for (const s of skills) {
    for (const f of walk(path.join(root, s))) {
      if (!TEXT.test(path.basename(f))) continue;
      read(f)
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (names && names.test(line)) err(f, i + 1, "private", `matches SKILLS_INTERNAL_PATTERNS: ${line.trim().slice(0, 80)}`);
          const ip = line.match(privateIP);
          if (ip && !docs.test(ip[0])) warn(f, i + 1, "private", `private IPv4 address ${ip[0]}`);
        });
    }
  }
}

for (const w of warnings) console.log("warning: " + w);
for (const e of errors) console.log("error: " + e);
console.log(`${skills.length} skills (${skills.filter((s) => kind[s] === "team").length} team, ${skills.filter((s) => kind[s] === "vendored").length} vendored): ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
