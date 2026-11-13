---
title: Wait for conditions in end-to-end tests, never for a fixed time or network idle
impact: LOW
tags: playwright, e2e, flaky-tests
check: scan
---

## Wait for conditions in end-to-end tests, never for a fixed time or network idle

**Impact: LOW** (slow, flaky suites that teach the team to ignore failures)

`waitForTimeout` is too short on a slow runner and wasted time on a fast one; `waitForLoadState("networkidle")` never settles on pages that poll and settles too early on pages that fetch after hydration. Wait with web-first assertions on the element the user would wait for.

**Incorrect:**

```ts
await page.getByRole("button", { name: "Save" }).click();
await page.waitForTimeout(2000);
await page.waitForLoadState("networkidle");
```

**Correct:**

```ts
await page.getByRole("button", { name: "Save" }).click();
await expect(page.getByRole("dialog", { name: "Edit customer" })).toBeHidden();
await expect(page.getByRole("row", { name: /North/ })).toBeVisible();
```

**How to check:** `scripts/scan.sh` flags `waitForTimeout(` and `networkidle` in `*.spec.ts`. Playwright's ESLint plugin (`eslint-plugin-playwright`, `no-wait-for-timeout`, `no-networkidle`) enforces it if the project uses it.
