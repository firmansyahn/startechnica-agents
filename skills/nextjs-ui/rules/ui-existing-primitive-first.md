---
title: Use an existing primitive or composite before writing markup
impact: HIGH
tags: shadcn, composites, accessibility
check: eslint, review
---

## Use an existing primitive or composite before writing markup

**Impact: HIGH** (hand-built widgets miss keyboard handling, focus management and theming)

Before building a table, dialog, drawer, dropdown, notice, empty state or confirmation, check `components/shadcn-ui/` and `components/<brand>-ui/`. Hand-built versions miss keyboard handling, focus management and theming.

**Incorrect:**

```tsx
<div className="fixed inset-0 bg-black/50"><div className="rounded bg-white p-6">...</div></div>
```

**Correct:**

```tsx
<Dialog open={open} onOpenChange={setOpen}><DialogContent>...</DialogContent></Dialog>
```

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports raw `<select>` and `<dialog>` in `app/` and `components/` (raw tables under ui-table-primitive) and warns on a `fixed inset-0` layer, a hand-built overlay; the shadcn primitives are exempt. Hand-built dropdowns, notices, empty states and confirmations stay review.
