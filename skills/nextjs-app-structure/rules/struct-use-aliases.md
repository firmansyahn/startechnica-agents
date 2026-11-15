---
title: Imports use the aliases, not long relative paths
impact: LOW
tags: folders
check: eslint
---

## Imports use the aliases, not long relative paths

**Impact: LOW**

Shared code is imported through `@/hooks/...`, `@/services/...`, `@/components/...`; relative imports stay inside a route folder (`./CustomerDialog`). A `../../../src/utils/format` breaks on the next move.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports imports, re-exports and `import()` that climb two or more folders (`../../`) in `app/`, `components/` and `src/`. One `../` inside a route folder (`../_shared/x`) passes.
