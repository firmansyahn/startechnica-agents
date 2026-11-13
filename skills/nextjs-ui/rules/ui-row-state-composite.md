---
title: Lists use the row-state composite with its default texts
impact: MEDIUM
tags: states, tables, composites
check: review
---

## Lists use the row-state composite with its default texts

**Impact: MEDIUM** (every list words and styles its empty and error rows differently, and some forget one)

Loading, empty and error rows come from the shared row-state composite, with its default texts ("No records found", "Failed to load records"), not per-page wording, unless the product asks for specific copy.

**Incorrect:**

```tsx
{rows.length === 0 && <tr><td className="text-center text-gray-400">Nothing here!</td></tr>}
```

**Correct:**

```tsx
<TableRowState state={list.isError ? "error" : rows.length === 0 ? "empty" : null} colSpan={5} />
```

**How to check:** look for hand-written empty or error `<tr>`s and per-page texts in place of the row-state composite.
