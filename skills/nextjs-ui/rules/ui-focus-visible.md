---
title: Focus is always visible
impact: HIGH
tags: accessibility, focus
check: review
---

## Focus is always visible

**Impact: HIGH** (keyboard users lose track of where they are)

Keep the primitives' `focus-visible` rings; never `outline-none` without a replacement. After a dialog closes, focus returns to its trigger (the primitives do it; don't unmount the trigger while the dialog is open).

**How to check:** search for `outline-none` or `focus:outline-none` without a `focus-visible:` replacement; tab through the page.
