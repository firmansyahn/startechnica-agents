#!/usr/bin/env bash
# peers.sh — read-only check of which installed libraries accept the target Next.js and React (nextjs-upgrade).
# For every dependency in package.json (or every installed package with --all) whose peerDependencies name
# react, react-dom or next, prints: <ok|blocks|check>\t<package>@<installed>\t<peer> <range>
#   ok      the range accepts the target version
#   blocks  it doesn't: find a release of the library that does (or ask the user to replace it)
#   check   no target given for that peer, or no semver module to compare with
# Then a count per status.
#
# Usage: bash peers.sh [app-root] [--next <version>] [--react <version>] [--all]
#   Run it before installing the target (to find blockers) and again after upgrading the libraries.
# Needs node on PATH; uses the semver package from node_modules when it is there (it nearly always is).

set -u
ROOT="."; NEXT_T=""; REACT_T=""; ALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --next) NEXT_T="${2:-}"; shift ;;
    --react) REACT_T="${2:-}"; shift ;;
    --all) ALL=1 ;;
    *) ROOT="$1" ;;
  esac
  shift
done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f package.json ] || { echo "no package.json in $ROOT" >&2; exit 2; }
[ -d node_modules ] || { echo "no node_modules in $ROOT: install first" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 2; }

NEXT_T="$NEXT_T" REACT_T="$REACT_T" ALL="$ALL" node -e '
const fs = require("fs"), path = require("path");
let semver = null;
try { semver = require(path.resolve("node_modules/semver")); } catch {}
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const target = { next: process.env.NEXT_T, react: process.env.REACT_T, "react-dom": process.env.REACT_T };
let names = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
if (process.env.ALL === "1") {
  names = [];
  for (const d of fs.readdirSync("node_modules")) {
    if (d.startsWith(".")) continue;
    if (d.startsWith("@")) for (const s of fs.readdirSync(path.join("node_modules", d))) names.push(`${d}/${s}`);
    else names.push(d);
  }
}
const count = {};
const rows = [];
for (const n of names) {
  if (["next", "react", "react-dom"].includes(n)) continue;
  let p;
  try { p = JSON.parse(fs.readFileSync(path.join("node_modules", n, "package.json"), "utf8")); } catch { continue; }
  const peers = p.peerDependencies || {};
  for (const peer of ["next", "react", "react-dom"]) {
    if (!peers[peer]) continue;
    const optional = p.peerDependenciesMeta && p.peerDependenciesMeta[peer] && p.peerDependenciesMeta[peer].optional;
    let status = "check";
    if (semver && target[peer]) status = semver.satisfies(target[peer], peers[peer], { includePrerelease: false }) ? "ok" : "blocks";
    rows.push(`${status}\t${n}@${p.version}\t${peer} ${peers[peer]}${optional ? " (optional)" : ""}`);
    count[status] = (count[status] || 0) + 1;
  }
}
const order = { blocks: 0, check: 1, ok: 2 };
rows.sort((a, b) => order[a.split("\t")[0]] - order[b.split("\t")[0]] || a.localeCompare(b));
for (const r of rows) console.log(r);
if (!semver) console.log("\n(no semver module in node_modules: every row is \"check\")");
console.log(`\n--- blocks ${count.blocks || 0}, check ${count.check || 0}, ok ${count.ok || 0} ---`);
'
exit 0
