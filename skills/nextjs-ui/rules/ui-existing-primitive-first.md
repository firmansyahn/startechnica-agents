---
title: Use an existing primitive or composite before writing markup
impact: HIGH
tags: shadcn, composites, accessibility
check: review
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

**How to check:** look for hand-built overlays (`fixed inset-0`), `<table>` or dropdown markup where a primitive or composite exists.
