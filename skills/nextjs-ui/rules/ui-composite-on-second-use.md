---
title: A pattern used twice becomes a composite
impact: MEDIUM
tags: composites, reuse
check: review
---

## A pattern used twice becomes a composite

**Impact: MEDIUM** (copies of one pattern drift apart and each needs its own fixes and tests)

The second page that needs "table with loading/empty/error rows and pagination", "create/edit drawer with Save/Cancel and a refusal notice" or "delete with confirmation" uses a composite in `components/<brand>-ui/`, with its own test, instead of a copy.

**How to check:** in review, look for a block of primitives that repeats one already on another page.
