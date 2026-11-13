---
title: Contrast meets AA in every theme
impact: MEDIUM
tags: accessibility, contrast, themes
check: test
---

## Contrast meets AA in every theme

**Impact: MEDIUM** (text becomes unreadable in some preset and mode combination)

Text 4.5:1, large text and control boundaries 3:1, checked per preset and mode by the contrast test (`../references/theme-presets.md`). `text-muted-foreground` on `bg-muted` is the usual offender; check it.

**How to check:** the contrast test per preset and mode (`../references/theme-presets.md`); check `text-muted-foreground` on `bg-muted` by hand when tokens change.
