---
title: Numbers and dates go through the formatters
impact: MEDIUM
tags: strings
check: eslint, review
---

## Numbers and dates go through the formatters

**Impact: MEDIUM**

Use next-intl's `useFormatter()` (or the project's shared formatter) for numbers, money, bytes, dates and relative times, never `toLocaleString()` in cells or raw ISO strings (`nextjs-ui` Tables rules).

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `toLocaleString()`, `toLocaleDateString()`, `toLocaleTimeString()` and `Intl.*` in `app/` and `components/` (the shared formatter lives in `src/`). Raw ISO strings and numbers rendered without a formatter stay review.
