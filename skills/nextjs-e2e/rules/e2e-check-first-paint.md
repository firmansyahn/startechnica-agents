---
title: Check the first paint, not only the settled page
impact: LOW
tags: visual
check: review
---

## Check the first paint, not only the settled page

**Impact: LOW**

The no-flash rule (`ui-no-theme-flash`) is about the first frame. Assert the `<html>` class and `data-*` attributes straight after `goto` returns, before any later wait.

**Correct:**

```ts
await page.goto("/app/items");
await expect(page.locator("html")).toHaveClass(/\bdark\b/);
await expect(page.locator("html")).toHaveAttribute("data-theme", "ocean");
```
