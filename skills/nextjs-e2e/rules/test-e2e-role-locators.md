---
title: Locate elements by role and accessible name in end-to-end tests, not by CSS or XPath
impact: LOW
tags: playwright, e2e, locators, accessibility
check: scan
---

## Locate elements by role and accessible name in end-to-end tests, not by CSS or XPath

**Impact: LOW** (tests break on every restyle, and unnamed controls go unnoticed)

`getByRole` with a name first, `getByLabel` for fields, `getByText` for static content, `getByTestId` last. CSS classes, DOM paths and `nth-child` change with layout; a control a test can only find by class usually lacks an accessible name.

**Incorrect:**

```ts
await page.locator("div.flex > button.bg-primary").click();
await page.locator("//table/tbody/tr[2]/td[3]").click();
```

**Correct:**

```ts
await page.getByRole("button", { name: "Add customer" }).click();
await page.getByRole("row", { name: /North/ }).getByRole("button", { name: "Edit" }).click();
```

**How to check:** `scripts/scan.sh` flags `page.locator(` / `.locator(` calls with a CSS class, an `>` combinator, `nth-child` or an XPath (`//`) in `*.spec.ts`. Confirm each: a locator for a region that has no role (a chart canvas) can be fine.
