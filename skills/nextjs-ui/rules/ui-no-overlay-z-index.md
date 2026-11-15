---
title: No z-index on overlays
impact: MEDIUM
tags: overlays, tailwind, stacking
check: eslint
---

## No `z-index` on overlays

**Impact: MEDIUM** (fixing one overlay's stacking breaks the next one opened above or below it)

Dialogs, sheets, popovers, menus and tooltips stack through their portals and the app root's `isolate` stacking context. Adding `z-50`/`z-[999]` to fix one overlay breaks the next. The only fixed layer is the toaster, set once in the layout.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `z-*` classes on the content part of a dialog, alert dialog, sheet, drawer, popover, menu, hover card, tooltip, select or command. A `z-[999]` on other elements isn't reported.
