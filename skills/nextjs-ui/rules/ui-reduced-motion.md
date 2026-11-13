---
title: Motion respects reduced-motion
impact: LOW
tags: accessibility, motion
check: review
---

## Motion respects reduced-motion

**Impact: LOW** (large or looping animation makes some users ill)

Transitions are short (150–250 ms) and use opacity/scale; anything larger or looping is wrapped in `motion-safe:` (or disabled under `motion-reduce:`).

**How to check:** look for transitions above 250 ms, large movements and looping animations without `motion-safe:` or `motion-reduce:`.
