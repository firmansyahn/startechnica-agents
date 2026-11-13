---
title: Assert with web-first expect, not with values read out
impact: LOW
tags: locators
check: review
---

## Assert with web-first expect, not with values read out

**Impact: LOW**

`expect(locator).toHaveText()`, `toBeVisible()`, `toHaveCount()`, `toHaveURL()` retry until they pass or time out. Reading a value and asserting on it checks one moment, usually too early.

**Incorrect:**

```ts
expect(await page.getByRole("status").textContent()).toBe("Saved");
expect(await page.getByRole("row").count()).toBe(3);
```

**Correct:**

```ts
await expect(page.getByRole("status")).toHaveText("Saved");
await expect(page.getByRole("row")).toHaveCount(3);
```
