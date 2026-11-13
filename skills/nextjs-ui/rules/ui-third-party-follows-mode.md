---
title: Make toasts and charts follow the theme
impact: LOW
tags: themes, charts, toasts
check: scan
---

## Make toasts and charts follow the theme

**Impact: LOW** (light toasts in dark mode; charts that never take the brand colors)

The Toaster gets the resolved mode (no hard-coded `theme="light"`). Chart colors read tokens directly (`var(--chart-1)`), never `hsl(var(--chart-1))` around OKLCH tokens, which makes the color invalid.

**Incorrect:**

```tsx
<Toaster theme="light" />
<Bar fill="hsl(var(--chart-1))" />
```

**Correct:**

```tsx
<Toaster theme={resolvedMode} />
<Bar fill="var(--chart-1)" />
```

**How to check:** `scripts/scan.sh` flags `Toaster` with a literal `theme=` and `hsl(var(--chart`.
