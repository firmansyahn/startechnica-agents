---
title: Tests sit beside the code they test
impact: LOW
tags: testing
check: review
---

## Tests sit beside the code they test

**Impact: LOW**

`ItemsClient.tsx` → `page.test.tsx` in the same folder; `src/utils/format.ts` → `src/utils/format.test.ts`. Only the harness, repo-wide rule tests and end-to-end specs live in `tests/`.
