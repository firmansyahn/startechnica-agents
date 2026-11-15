---
title: Installs are immutable, with one lockfile
impact: MEDIUM
tags: dependencies
check: scan
---

## Installs are immutable, with one lockfile

**Impact: MEDIUM**

CI and Docker run `yarn install --immutable` (through the committed release, `nextjs-package-manager`); a missing or changed lockfile fails the job. No `package-lock.json` or `pnpm-lock.yaml` beside `yarn.lock`.

Related: `tool-yarn-only`.

**How to check:** `scripts/scan.sh` flags a bare `yarn` or a `yarn install` (also `node .yarn/releases/yarn-*.cjs install`) without `--immutable` in the repo's GitLab CI files, GitHub workflows and Dockerfiles/Containerfiles, and `enableImmutableInstalls: false` in `.yarnrc.yml`. Extra lockfiles beside `yarn.lock` are `nextjs-package-manager`'s scan (`tool-yarn-only`).
