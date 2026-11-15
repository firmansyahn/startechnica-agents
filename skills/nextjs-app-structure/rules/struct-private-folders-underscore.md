---
title: Private route folders start with an underscore
impact: LOW
tags: folders
check: scan (candidates), review
---

## Private route folders start with an underscore

**Impact: LOW**

`_shared/`, `_components/`: the router ignores them, so they never become URLs. A folder meant as a URL segment never starts with `_`; a grouping that shouldn't appear in the URL is a route group `(name)/`.

**How to check:** `scripts/scan.sh` lists folders under `app/` named `components`, `shared`, `hooks`, `utils`, `lib` or `helpers` without the underscore, and a `page.tsx` or `route.ts` inside a `_folder` (never routed). A real URL segment with one of those names is a false hit; other private folders stay review.
