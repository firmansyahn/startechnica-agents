---
title: Installs are immutable, with one lockfile
impact: MEDIUM
tags: dependencies
check: review
---

## Installs are immutable, with one lockfile

**Impact: MEDIUM**

CI and Docker run `yarn install --immutable` (through the committed release, `nextjs-package-manager`); a missing or changed lockfile fails the job. No `package-lock.json` or `pnpm-lock.yaml` beside `yarn.lock`.

Related: `tool-yarn-only`.
