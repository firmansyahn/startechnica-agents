---
title: Mobile first, and no horizontal page scroll
impact: MEDIUM
tags: layout, responsive
check: review
---

## Mobile first, and no horizontal page scroll

**Impact: MEDIUM** (the page breaks or scrolls sideways on phones)

Unprefixed classes are the phone layout; `sm:`/`md:`/`lg:` widen it. Grids collapse to one column on phones (`grid gap-4 md:grid-cols-2`). Only tables, code and diagrams may scroll sideways, each in its own `overflow-x-auto` container. Check every page at about 400 px wide.

**How to check:** load the page at about 400 px wide; check grids collapse to one column and only tables, code and diagrams scroll sideways.
