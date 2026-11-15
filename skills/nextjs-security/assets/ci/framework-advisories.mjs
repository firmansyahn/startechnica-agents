#!/usr/bin/env node
// framework-advisories.mjs — rule deps-framework-patches-fast: fail when the dependency audit lists any
// advisory, at any severity, for Next.js or React. Run daily by the scheduled job in
// security.gitlab-ci.yml, so a framework patch is applied within days of its release, not at the next
// planned upgrade. Copy to <app-root>/scripts/ci/.
//
//   node .yarn/releases/yarn-*.cjs npm audit --all --recursive --environment production --json > audit.ndjson; code=$?
//   node scripts/ci/framework-advisories.mjs audit.ndjson "$code"
//
// Input: the NDJSON `yarn npm audit --json` prints (Yarn 4: one {"value": <package>, "children": {...}}
// line per advisory). The audit's exit code tells "found advisories" (1, with advisory lines) from
// "couldn't run" (non-zero, none parsed), which fails too. Other packages' advisories are left to the
// merge-request audit (tool-dependency-audit), by severity.
import fs from "node:fs";

// The framework packages: their advisories go in within days whatever the severity.
const FRAMEWORK = /^(?:next|react|react-dom|react-server-dom-[a-z]+|@next\/[a-z0-9-]+)$/;

const [file, code = "0"] = process.argv.slice(2);
if (!file) {
  console.error("usage: framework-advisories.mjs <audit.ndjson> [audit-exit-code]");
  process.exit(2);
}
const text = fs.readFileSync(file, "utf8");
const advisories = [];
for (const line of text.split(/\r?\n/)) {
  if (!line.trim().startsWith("{")) continue;
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  const name = typeof row.value === "string" ? row.value : row.value?.name ?? row.module_name;
  if (typeof name === "string" && row.children) advisories.push({ name, ...row.children });
}

if (code !== "0" && advisories.length === 0) {
  console.error(`the audit exited ${code} without listing advisories: it didn't run (network, registry, flags)\n${text.slice(0, 2000)}`);
  process.exit(2);
}
const hits = advisories.filter((a) => FRAMEWORK.test(a.name));
if (hits.length === 0) {
  console.log(`no Next.js or React advisory (${advisories.length} other advisories, left to the merge-request audit)`);
  process.exit(0);
}
console.error(`${hits.length} Next.js or React advisories: update to the patched release now (deps-framework-patches-fast)`);
for (const a of hits)
  console.error(`- ${a.name} ${(a["Tree Versions"] ?? []).join(", ")}: [${a.Severity}] ${a.Issue} (vulnerable ${a["Vulnerable Versions"]}) ${a.URL}`);
process.exit(1);
