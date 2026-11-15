---
title: Mobile first, and no horizontal page scroll
impact: MEDIUM
tags: layout, responsive
check: test (e2e), review
---

## Mobile first, and no horizontal page scroll

**Impact: MEDIUM** (the page breaks or scrolls sideways on phones)

Unprefixed classes are the phone layout; `sm:`/`md:`/`lg:` widen it. Grids collapse to one column on phones (`grid gap-4 md:grid-cols-2`). Only tables, code and diagrams may scroll sideways, each in its own `overflow-x-auto` container. Check every page at about 400 px wide.

**How to check:** nextjs-e2e's [assets/layout.spec.ts](../../nextjs-e2e/assets/layout.spec.ts) loads each page in its `PAGES` list at 400 px and fails when the page is wider than the viewport, or when `html` or `body` hides the overflow with `overflow-x: hidden`, naming the elements past the right edge. It misses pages not in the list and states reached only after an interaction (an open dialog, a long value typed in). Whether grids collapse to one column and the unprefixed classes are the phone layout stays review.
