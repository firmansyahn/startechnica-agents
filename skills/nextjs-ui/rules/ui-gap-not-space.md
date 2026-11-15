---
title: gap-*, not space-x-* / space-y-*
impact: LOW
tags: tailwind, layout
check: eslint
---

## `gap-*`, not `space-x-*` / `space-y-*`

**Impact: LOW** (spacing breaks with wrapping, conditional children and portals)

Use `flex`/`grid` with `gap-*`. `space-*` breaks with wrapping, conditional children and portals.

**Incorrect:**

```tsx
<div className="space-y-4">...</div>
```

**Correct:**

```tsx
<div className="flex flex-col gap-4">...</div>
```

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `space-x-*` and `space-y-*` classes (with or without a variant) in strings and template literals in `app/`, `components/` and `src/`; the shadcn primitives are exempt. A prose renderer that needs them carries a disable comment with the reason.
