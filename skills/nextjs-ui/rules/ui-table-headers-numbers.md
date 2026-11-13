---
title: Every column has a header; numbers right-aligned
impact: LOW
tags: tables, accessibility
check: review
---

## Every column has a header; numbers right-aligned

**Impact: LOW** (screen readers announce unnamed columns, and figures don't line up)

Headers name the column (including an actions column, visually hidden if needed). Numeric columns are `text-right tabular-nums`, and the header aligns with them.

**Incorrect:**

```tsx
<TableHead />
<TableCell>{row.sessions}</TableCell>
```

**Correct:**

```tsx
<TableHead><span className="sr-only">{t("actions")}</span></TableHead>
<TableHead className="text-right">{t("sessions")}</TableHead>
<TableCell className="text-right tabular-nums">{formatNumber(row.sessions)}</TableCell>
```

**How to check:** look for empty `TableHead`s and numeric columns without `text-right tabular-nums` on the cell and its header.
