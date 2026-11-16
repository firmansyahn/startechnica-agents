#!/usr/bin/env node
// bump-version.mjs: set the version in every plugin manifest and package, so they never drift.
//
//   node scripts/bump-version.mjs 0.2.0
//   node scripts/bump-version.mjs --check   exit 1 when the manifests carry different versions (CI)
//
// Then commit, merge, and tag the merge commit v<version> (see AGENTS.md, "Releasing").

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const files = [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json", ".codex-plugin/plugin.json", ".cursor-plugin/plugin.json", "gemini-extension.json", "package.json", "package-lock.json"];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));

if (process.argv[2] === "--check") {
  const seen = [];
  for (const f of files) {
    const j = read(f);
    for (const v of [j.version, j.metadata?.version, j.packages?.[""]?.version, ...(j.plugins || []).map((p) => p.version)]) if (v !== undefined) seen.push([f, v]);
  }
  const versions = new Set(seen.map(([, v]) => v));
  if (versions.size !== 1) {
    console.error(`manifest versions differ:\n  ${seen.map(([f, v]) => `${f}: ${v}`).join("\n  ")}`);
    process.exit(1);
  }
  console.log(`all manifests at ${[...versions][0]}`);
  process.exit(0);
}

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("usage: node scripts/bump-version.mjs <major.minor.patch> | --check");
  process.exit(2);
}
for (const f of files) {
  const j = read(f);
  if ("version" in j) j.version = version;
  if (j.metadata && "version" in j.metadata) j.metadata.version = version;
  if (j.packages?.[""] && "version" in j.packages[""]) j.packages[""].version = version;
  for (const pl of j.plugins || []) if ("version" in pl) pl.version = version;
  fs.writeFileSync(path.join(root, f), JSON.stringify(j, null, 2) + "\n");
  console.log(`${f}: ${version}`);
}
