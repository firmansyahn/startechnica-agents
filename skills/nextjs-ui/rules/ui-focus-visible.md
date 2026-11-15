---
title: Focus is always visible
impact: HIGH
tags: accessibility, focus
check: scan (candidates), review
---

## Focus is always visible

**Impact: HIGH** (keyboard users lose track of where they are)

Keep the primitives' `focus-visible` rings; never `outline-none` without a replacement. After a dialog closes, focus returns to its trigger (the primitives do it; don't unmount the trigger while the dialog is open).

**How to check:** `scripts/scan.sh` lists `outline-none`/`outline-hidden` with no `focus-visible:` class on the same line, and `outline: none`/`0` in CSS or inline styles, outside `components/shadcn-ui/`. A replacement on another line of a `cn()` call is a false hit. Focus returning to the trigger after a dialog closes, and tabbing through the page, stay review (or an e2e test).
