---
title: Dates and times are formatted, localised and absolute
impact: LOW
tags: tables, dates, i18n
check: eslint, review
---

## Dates and times are formatted, localised and absolute

**Impact: LOW** (raw ISO strings, mixed formats and relative times without the real date)

Use the shared date formatter (locale and time zone aware), not `toLocaleString()` scattered in cells or raw ISO strings. Relative times ("3 minutes ago") carry the absolute value in a `title`/tooltip.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `toLocaleString()`, `toLocaleDateString()`, `toLocaleTimeString()` and `Intl.*` in `app/` and `components/`, under the ID i18n-use-formatters. Raw ISO strings (`toISOString()` also builds API parameters), raw date fields in cells and relative times without the absolute value in a `title` stay review.
