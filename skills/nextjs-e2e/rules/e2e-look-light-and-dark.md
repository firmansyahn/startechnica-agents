---
title: Every visual change is looked at in light and dark
impact: LOW
tags: visual
check: review
---

## Every visual change is looked at in light and dark

**Impact: LOW**

Run `yarn shots <path>` for every page the change touches (and `--presets` when tokens changed) and look at the images before calling it done. A passing test suite doesn't show a white card on a dark page.
