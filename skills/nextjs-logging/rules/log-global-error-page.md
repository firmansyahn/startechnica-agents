---
title: The root layout has a global-error page
impact: MEDIUM
tags: errors
check: scan
---

## The root layout has a global-error page

**Impact: MEDIUM**

`app/global-error.tsx` catches errors in the root layout and renders its own `<html>` and `<body>`; without it, a root-layout error shows Next's bare default page.

**How to check:** `scripts/scan.sh` flags an `app/` or `src/app/` without `global-error.tsx` (or `.jsx`/`.ts`/`.js`), and a global-error page that renders no `<html>` or no `<body>` of its own.
