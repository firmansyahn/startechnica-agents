---
title: Keep the previous page while the next one loads
impact: HIGH
tags: queries
check: review
---

## Keep the previous page while the next one loads

**Impact: HIGH**

Paging, sorting and searching use `placeholderData: keepPreviousData`, so the table shows the old rows (dimmed by `isPlaceholderData` if wanted) instead of flashing empty.
