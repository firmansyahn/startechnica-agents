---
title: Tabs, groups and items stay inside their parents
impact: MEDIUM
tags: base-ui, shadcn, accessibility
check: review
---

## Tabs, groups and items stay inside their parents

**Impact: MEDIUM** (parts outside their parent lose context, keyboard navigation and ARIA wiring)

`TabsTrigger` inside `TabsList`, `SelectItem` inside `SelectContent` (and groups inside it), `DropdownMenuItem` inside `DropdownMenuContent`, `FieldLabel`/`FieldError` inside `Field`. Parts outside their parent lose context, keyboard navigation and ARIA wiring.

**How to check:** check that `TabsTrigger`, `SelectItem`, `DropdownMenuItem`, `FieldLabel` and `FieldError` render inside their parent part.
