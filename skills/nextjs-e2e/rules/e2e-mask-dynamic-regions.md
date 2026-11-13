---
title: Mask dynamic regions instead of raising thresholds
impact: LOW
tags: visual
check: review
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
