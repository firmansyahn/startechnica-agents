---
title: Use Yarn only, with one lockfile
impact: LOW
tags: tooling, package-manager
check: scan
---

## Use Yarn only, with one lockfile

**Impact: LOW** (different dependency trees per machine and in CI)

Every install, script and one-off CLI runs through Yarn (`yarn`, `yarn dlx`), pinned by `packageManager` and a committed `yarnPath` release. `yarn.lock` is the only lockfile. Scripts, CI files, Dockerfiles and docs contain no `npm`, `npx`, `pnpm` or `bunx` (installing the Yarn launcher once is the exception).

**Incorrect:**

```json
"scripts": { "gen": "npx openapi-typescript spec.json -o types.ts" }
```

**Correct:**

```json
"scripts": { "gen": "openapi-typescript spec.json -o types.ts" }
```

**How to check:** `scripts/scan.sh` flags `package-lock.json`, `pnpm-lock.yaml` and `bun.lock*` next to `yarn.lock`, and `npx`/`pnpm`/`bunx`/`npm (i|install|run|ci)` in `package.json` scripts, Dockerfiles, CI files and Markdown.
