---
title: Specs are .spec.ts, unit tests .test.ts(x)
impact: MEDIUM
tags: scope-and-ci
check: review
---

## Specs are .spec.ts, unit tests .test.ts(x)

**Impact: MEDIUM**

Playwright's `testMatch: "**/*.spec.ts"`; Vitest includes only `*.test.ts(x)`. A spec named `.test.ts` runs under Vitest and fails confusingly.
