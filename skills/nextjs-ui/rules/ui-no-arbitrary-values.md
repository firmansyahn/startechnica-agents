---
title: No arbitrary values where the scale has one
impact: LOW
tags: tailwind, classes
check: review
---

## No arbitrary values where the scale has one

**Impact: LOW** (one-off sizes drift from the scale and ignore the theme's spacing and radius)

`p-[16px]`, `text-[14px]`, `rounded-[8px]` duplicate `p-4`, `text-sm`, `rounded-lg`. Arbitrary values are for one-off measurements (`w-[372px]` for a fixed panel), never for colors.

**How to check:** search for `-[` values in `className` (`p-[`, `text-[`, `rounded-[`) and confirm the scale has no equivalent.
