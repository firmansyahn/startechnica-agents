---
title: The root layout has a global-error page
impact: MEDIUM
tags: errors
check: review
---

## The root layout has a global-error page

**Impact: MEDIUM**

`app/global-error.tsx` catches errors in the root layout and renders its own `<html>` and `<body>`; without it, a root-layout error shows Next's bare default page.
