---
title: Raise Node everywhere the app runs, not only locally
impact: HIGH
tags: upgrade, node, docker, ci
check: scan
---

## Raise Node everywhere the app runs, not only locally

**Impact: HIGH** (the app builds on a laptop and fails in CI or at container start on the old Node)

Next 16 needs Node 20.9 or later; take the current LTS. The version is set in `.nvmrc` or `.node-version`, in `engines.node`, in every Dockerfile `FROM node:` stage, and in every CI image. Raise all of them in one checkpoint, and set TypeScript to 5.1 or later in the same one.

**Incorrect:**

```text
# .nvmrc
22
# Dockerfile
FROM node:18-alpine AS deps
```

**Correct:**

```text
# .nvmrc
24
# Dockerfile
FROM node:24-alpine AS deps
```

**How to check:** `scripts/scan.sh` flags `node:` images below 20, `.nvmrc`/`.node-version` below 20, and an `engines.node` that names 12 to 18.
