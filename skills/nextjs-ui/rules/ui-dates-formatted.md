---
title: Dates and times are formatted, localised and absolute
impact: LOW
tags: tables, dates, i18n
check: review
---

## Dates and times are formatted, localised and absolute

**Impact: LOW** (raw ISO strings, mixed formats and relative times without the real date)

Use the shared date formatter (locale and time zone aware), not `toLocaleString()` scattered in cells or raw ISO strings. Relative times ("3 minutes ago") carry the absolute value in a `title`/tooltip.

**How to check:** search for `toLocaleString(`, `toISOString(` and raw date fields rendered in cells.
