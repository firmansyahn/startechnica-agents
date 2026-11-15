---
title: Assert with web-first expect, not with values read out
impact: LOW
tags: locators
check: eslint
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) turns on `playwright/prefer-web-first-assertions`, `playwright/prefer-to-have-count` and `playwright/missing-playwright-await` in `tests/**/*.spec.ts`: a value read out and then asserted, a `.count()` compared, and an `expect(locator)` without `await`.
