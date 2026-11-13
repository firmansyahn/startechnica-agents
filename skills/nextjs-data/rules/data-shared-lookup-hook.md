---
title: Lookup lists are one shared query and a hook
impact: HIGH
tags: queries
check: review
---

## Lookup lists are one shared query and a hook

**Impact: HIGH**

Names for selects (categories, projects, users) come from one registry query per list behind a small hook (`useCategoryNames()`), reused by every page, so the list is fetched once and invalidated in one place.
