---
title: Tables are the Table primitive plus the list composites
impact: MEDIUM
tags: tables, shadcn, composites
check: eslint, review
---

## Tables are the Table primitive plus the list composites

**Impact: MEDIUM** (hand-made tables miss semantics, row states, pagination and theming)

`Table`/`TableHeader`/`TableRow`/`TableCell` from the primitives; loading/empty/error rows, pagination, search and sortable heads from the list composites. No `<table>` with hand-written classes, no div grids pretending to be tables.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports raw `table`, `thead`, `tbody`, `tfoot`, `tr`, `th` and `td` elements in `app/` and `components/`; the shadcn primitives are exempt. Div grids laid out as tables, and lists without the composites' loading, empty and error rows, stay review.
