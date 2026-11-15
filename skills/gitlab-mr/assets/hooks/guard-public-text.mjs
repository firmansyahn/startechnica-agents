#!/usr/bin/env node
// Claude Code PreToolUse hook for the Bash tool: in a public repo (or one whose visibility can't be
// read), refuses to publish text that carries an IPv4 address outside the documentation ranges, a
// non-noreply email address, or one of the project's internal names (mr-no-internal-details-public).
//
// It checks, where the shell would run them:
//   glab mr create|update|note, glab release create, gh pr create|edit|comment, gh release create:
//     the command text, and the files it reads its text from ($(cat <file>), $(< <file>),
//     --body-file/-F <file>, --notes-file <file>; a path held in a variable can't be read, so it is
//     refused: pass the literal path)
//   git push: the messages and added lines of every commit no remote has yet, and the branch names
// Visibility comes from glab (GitLab) or gh (an origin on github.com); internal and private repos pass.
//
// Internal names are an extended regex in INTERNAL_PATTERNS (case-insensitive), set where the agent
// runs, never committed: the "env" block of .claude/settings.local.json, or the shell profile. It is
// only as complete as that list; products and network setup described in prose stay review. A false
// positive (a four-part version number, a public contact address) passes with PUBLIC_TEXT_OK=1 in
// front of the command, written on purpose.
//
// Register in .claude/settings.json:
//   "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command",
//     "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-public-text.mjs\"", "timeout": 40 } ] } ] }
//
// Exit 2 refuses the call and shows stderr to the agent; exit 0 lets it run.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
const command = String(input.tool_input?.command ?? "");
const native = (p) => (process.platform === "win32" ? p.replace(/^\/([a-zA-Z])(?=\/|$)/, "$1:") : p);
const cwd = native(input.cwd || process.cwd());
const unquote = (s) => s.replace(/^(['"])(.*)\1$/, "$2");

// A command counts only where the shell would run it: at the start, or after ; & | ( or a newline,
// after any NAME=value assignments.
const AT = String.raw`(?:^|[;&|(\n])\s*((?:[A-Za-z_]\w*=\S*\s+)*)`;
const PUBLISH = new RegExp(`${AT}((?:glab\\s+mr\\s+(?:create|update|note)|glab\\s+release\\s+create|gh\\s+pr\\s+(?:create|edit|comment)|gh\\s+release\\s+create|git\\s+push)\\b)`, "g");

const found = [...command.matchAll(PUBLISH)].filter((m) => !/(?:^|\s)PUBLIC_TEXT_OK=1(?:\s|$)/.test(m[1]));
if (!found.length) process.exit(0);

function run(file, args) {
  try {
    return execFileSync(file, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20_000, maxBuffer: 64 << 20, windowsHide: true });
  } catch {
    return null;
  }
}

// Public, or unknown: check. Internal and private: pass.
const origin = (run("git", ["remote", "get-url", "origin"]) ?? "").trim();
const visibility = /github\.com[:/]/.test(origin)
  ? (run("gh", ["repo", "view", "--json", "visibility", "-q", ".visibility"]) ?? "").trim().toLowerCase()
  : (() => {
      try {
        return String(JSON.parse(run("glab", ["repo", "view", "-F", "json"]) ?? "{}").visibility ?? "").toLowerCase();
      } catch {
        return "";
      }
    })();
if (visibility === "private" || visibility === "internal") process.exit(0);

const IPV4 = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?!\.?\d)/g;
const OK_IP = /^(?:0\.0\.0\.0|127\.0\.0\.1|192\.0\.2\.\d+|198\.51\.100\.\d+|203\.0\.113\.\d+|255\.255\.255\.\d+)$/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const okEmail = (e) => /noreply/i.test(e) || /^git@/i.test(e) || /@(?:[\w-]+\.)*(?:example\.(?:com|org|net)|[\w-]+\.(?:example|test|invalid|localhost))$/i.test(e);
let internal = null;
try {
  if (process.env.INTERNAL_PATTERNS) internal = new RegExp(process.env.INTERNAL_PATTERNS, "gi");
} catch {
  process.stderr.write("guard-public-text: INTERNAL_PATTERNS is not a valid regex; only IPs and emails are checked.\n");
}

const hits = [];
function check(where, text) {
  for (const line of text.split(/\r?\n/)) {
    const what = [
      ...[...line.matchAll(IPV4)].map((x) => x[0]).filter((ip) => !OK_IP.test(ip)),
      ...[...line.matchAll(EMAIL)].map((x) => x[0]).filter((e) => !okEmail(e)),
      ...(internal ? [...line.matchAll(internal)].map((x) => x[0]) : []),
    ];
    if (what.length) hits.push(`${where}: ${[...new Set(what)].join(", ")}  |  ${line.trim().slice(0, 120)}`);
  }
}

for (const m of found) {
  const verb = m[2].replace(/\s+/g, " ");
  // The rest of the command: a quoted description may hold ; or && itself, so nothing is cut off.
  const segment = command.slice(m.index);
  if (verb === "git push") {
    const args = segment.split(/(?:&&|\|\||[;|\n])/)[0].replace(/^[;&|(\s]*(?:[A-Za-z_]\w*=\S*\s+)*git\s+push\b/, "");
    const refs = args.trim().split(/\s+/).filter((a) => a && !a.startsWith("-")).slice(1);
    check("branch", [run("git", ["rev-parse", "--abbrev-ref", "HEAD"])?.trim() ?? "", ...refs].join("\n"));
    check("unpushed commit message", run("git", ["log", "--format=%B", "HEAD", "--not", "--remotes"]) ?? "");
    const added = (run("git", ["log", "-p", "--format=", "HEAD", "--not", "--remotes"]) ?? "")
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++ "))
      .map((l) => l.slice(1))
      .join("\n");
    check("unpushed added line", added);
  } else {
    check(verb, segment);
    const files = [
      ...segment.matchAll(/\$\(\s*(?:cat\s+|<\s*)("[^"]+"|'[^']+'|[^\s)]+)\s*\)/g),
      ...segment.matchAll(/(?:--body-file|--notes-file|(?<=gh\s+pr\s+\S+.*)\s-F)\s+("[^"]+"|'[^']+'|\S+)/g),
    ].map((f) => unquote(f[1]));
    for (const f of files) {
      if (/\$/.test(f)) {
        hits.push(`${verb}: reads its text from ${f}, which the hook can't resolve; pass the file by its literal path so it can be checked`);
        continue;
      }
      try {
        check(f, fs.readFileSync(path.resolve(cwd, native(f)), "utf8"));
      } catch {}
    }
  }
}

if (hits.length) {
  process.stderr.write(
    `Refused: this repo is ${visibility ? visibility : "of unknown visibility (treated as public)"}, and the text about to be published carries what looks internal (mr-no-internal-details-public):\n` +
      hits.slice(0, 12).map((h) => `  ${h}`).join("\n") + (hits.length > 12 ? `\n  ... ${hits.length - 12} more` : "") +
      `\nDescribe it generically ("a DB host", "one cluster"), use documentation IPs (192.0.2.0/24) and example.com addresses. ` +
      `If something internal is already in a pushed commit, stop and tell the user. If these are false positives, run the command again with PUBLIC_TEXT_OK=1 in front.\n`,
  );
  process.exit(2);
}
process.exit(0);
