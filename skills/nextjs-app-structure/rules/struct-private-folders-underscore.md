---
title: Private route folders start with an underscore
impact: LOW
tags: folders
check: review
---

## Private route folders start with an underscore

**Impact: LOW**

`_shared/`, `_components/`: the router ignores them, so they never become URLs. A folder meant as a URL segment never starts with `_`; a grouping that shouldn't appear in the URL is a route group `(name)/`.
