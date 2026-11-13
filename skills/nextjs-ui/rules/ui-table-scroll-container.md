---
title: Wide tables scroll inside their container
impact: MEDIUM
tags: tables, responsive
check: review
---

## Wide tables scroll inside their container

**Impact: MEDIUM** (the whole page scrolls sideways on phones)

Wrap the table in an `overflow-x-auto` container so the page body never scrolls sideways; keep the first column readable on phones (or switch to a card list under `sm:` if the product needs it).

**How to check:** load the page at about 400 px wide: only the table's own `overflow-x-auto` container may scroll.
