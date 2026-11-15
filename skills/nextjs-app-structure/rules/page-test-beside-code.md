---
title: Tests sit beside the code they test
impact: LOW
tags: testing
check: test
---

## Tests sit beside the code they test

**Impact: LOW**

`ItemsClient.tsx` → `page.test.tsx` in the same folder; `src/utils/format.ts` → `src/utils/format.test.ts`. Only the harness, repo-wide rule tests and end-to-end specs live in `tests/`.

**How to check:** `templates/test-layout.test.ts` fails on a `__tests__/` folder anywhere and on a test in `tests/` that imports the app's code (`@/`, `~/` or `../`): rule tests read the tree with `node:fs`, and `tests/e2e/` is skipped. An `ALLOWED_IN_TESTS` list with reasons fails when stale.
