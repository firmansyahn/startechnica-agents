---
title: Numbers and dates go through the formatters
impact: MEDIUM
tags: strings
check: review
---

## Numbers and dates go through the formatters

**Impact: MEDIUM**

Use next-intl's `useFormatter()` (or the project's shared formatter) for numbers, money, bytes, dates and relative times, never `toLocaleString()` in cells or raw ISO strings (`nextjs-ui` Tables rules).
