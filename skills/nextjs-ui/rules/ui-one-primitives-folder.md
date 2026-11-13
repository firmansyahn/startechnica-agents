---
title: Import primitives from components/shadcn-ui only
impact: LOW
tags: shadcn, structure
check: eslint
---

## Import primitives from components/shadcn-ui only

**Impact: LOW** (two diverging copies of the same primitive)

Generated shadcn primitives live in `components/shadcn-ui/` (the `ui` alias in `components.json`). Composites built on them live in `components/<brand>-ui/`. Imports from shadcn's default `@/components/ui` are banned, so a CLI run or a pasted example can't start a second folder.

**Incorrect:**

```tsx
import { Button } from "@/components/ui/button";
```

**Correct:**

```tsx
import { Button } from "@/components/shadcn-ui/button";
```

**How to check:** `assets/eslint.config.mjs` (`no-restricted-imports` on `@/components/ui` and `@/components/ui/*`); `scripts/scan.sh` also flags the import and the folder's existence.
