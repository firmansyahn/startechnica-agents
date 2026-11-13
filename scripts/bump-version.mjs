#!/usr/bin/env node
// bump-version.mjs: set the package version in every plugin manifest, so they never drift.
//
//   node scripts/bump-version.mjs 0.2.0
//
// Then commit, merge, and tag the merge commit v<version> (see AGENTS.md, "Releasing").

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("usage: node scripts/bump-version.mjs <major.minor.patch>");
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [".claude-plugin/plugin.json", ".claude-plugin/marketplace.json", ".codex-plugin/plugin.json", ".cursor-plugin/plugin.json", "gemini-extension.json"];
for (const f of files) {
  const p = path.join(root, f);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  if ("version" in j) j.version = version;
  if (j.metadata && "version" in j.metadata) j.metadata.version = version;
  for (const pl of j.plugins || []) if ("version" in pl) pl.version = version;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  console.log(`${f}: ${version}`);
}
