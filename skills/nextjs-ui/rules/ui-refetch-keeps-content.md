---
title: Background refetches don't blank the content
impact: MEDIUM
tags: states, tanstack-query, loading
check: review
---

## Background refetches don't blank the content

**Impact: MEDIUM** (data flashes away on every refetch, page change or filter change)

`isFetching` after data exists shows at most a subtle indicator; keep the data on screen. Paginated and filtered lists use `placeholderData: keepPreviousData`.

**How to check:** look for loading states keyed on `isFetching`, and paginated or filtered lists without `placeholderData: keepPreviousData`.
