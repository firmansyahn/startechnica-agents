---
title: gap-*, not space-x-* / space-y-*
impact: LOW
tags: tailwind, layout
check: review
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

**How to check:** search for `space-x-` and `space-y-` in `className`.
