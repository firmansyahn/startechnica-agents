---
title: Specs are .spec.ts, unit tests .test.ts(x)
impact: MEDIUM
tags: scope-and-ci
check: eslint, review
---

## Specs are .spec.ts, unit tests .test.ts(x)

**Impact: MEDIUM**

Playwright's `testMatch: "**/*.spec.ts"`; Vitest includes only `*.test.ts(x)`. A spec named `.test.ts` runs under Vitest and fails confusingly.

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) refuses `@playwright/test` imports in `*.test.ts(x)` and `vitest` imports in `*.spec.ts(x)`. It misses a misnamed spec that imports `test` from the project's fixtures module (`tests/e2e/fixtures.ts`); look for `.test.ts` files under `tests/e2e/` in review.
