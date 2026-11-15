---
title: Freeze what moves before a screenshot
impact: LOW
tags: visual
check: test, review
---

## Freeze what moves before a screenshot

**Impact: LOW**

Fixed clock, fonts loaded (`document.fonts.ready`), animations disabled, caret hidden, data loaded (a row visible). Set the animation and caret options once in the config's `expect.toHaveScreenshot`.

**How to check:** [assets/tests/e2e-setup.test.ts](../assets/tests/e2e-setup.test.ts) fails unless the config's `expect.toHaveScreenshot` has `animations: "disabled"` and `caret: "hide"`. The fixed clock is `e2e-fixed-clock`'s check; fonts and data loaded before each screenshot stay review.
