---
title: Mask dynamic regions instead of raising thresholds
impact: LOW
tags: visual
check: eslint
---

## Mask dynamic regions instead of raising thresholds

**Impact: LOW**

Live counters, charts with random data, avatars from elsewhere: `mask: [locator]` or a `stylePath` stylesheet that hides them. A `maxDiffPixelRatio` of 0.1 lets real regressions through.

**Incorrect:**

```ts
await expect(page).toHaveScreenshot("dashboard.png", { maxDiffPixelRatio: 0.15 });
```

**Correct:**

```ts
await expect(page).toHaveScreenshot("dashboard.png", { mask: [page.getByTestId("live-sessions")] });
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags, in `tests/**/*.spec.ts` and `playwright.config.*`, a `maxDiffPixelRatio` above 0.01, a `maxDiffPixels` of 100 or more and a `threshold` above 0.2 (the limits are the team's, set in the selector). It misses a threshold passed through a variable.
