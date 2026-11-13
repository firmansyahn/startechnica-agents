---
title: Tables are the Table primitive plus the list composites
impact: MEDIUM
tags: tables, shadcn, composites
check: review
---

## Tables are the Table primitive plus the list composites

**Impact: MEDIUM** (hand-made tables miss semantics, row states, pagination and theming)

`Table`/`TableHeader`/`TableRow`/`TableCell` from the primitives; loading/empty/error rows, pagination, search and sortable heads from the list composites. No `<table>` with hand-written classes, no div grids pretending to be tables.

**How to check:** search for raw `<table>` with hand-written classes and for div grids laid out as tables.
