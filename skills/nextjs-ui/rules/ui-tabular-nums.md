---
title: Numbers use tabular-nums
impact: LOW
tags: tailwind, tables, typography
check: review
---

## Numbers use `tabular-nums`

**Impact: LOW** (columns of figures don't line up, or a monospace font changes the look of the row)

Counts, amounts, durations and IDs in tables and stats line up with `tabular-nums` and right alignment, not a monospace font.

**Incorrect:**

```tsx
<TableCell className="font-mono">{formatBytes(row.usage)}</TableCell>
```

**Correct:**

```tsx
<TableCell className="text-right tabular-nums">{formatBytes(row.usage)}</TableCell>
```

**How to check:** look for numeric table cells and stats without `tabular-nums`, or with `font-mono`.
