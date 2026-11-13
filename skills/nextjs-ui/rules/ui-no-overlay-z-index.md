---
title: No z-index on overlays
impact: MEDIUM
tags: overlays, tailwind, stacking
check: review
---

## No `z-index` on overlays

**Impact: MEDIUM** (fixing one overlay's stacking breaks the next one opened above or below it)

Dialogs, sheets, popovers, menus and tooltips stack through their portals and the app root's `isolate` stacking context. Adding `z-50`/`z-[999]` to fix one overlay breaks the next. The only fixed layer is the toaster, set once in the layout.

**How to check:** search for `z-` classes on dialog, sheet, popover, menu and tooltip content.
