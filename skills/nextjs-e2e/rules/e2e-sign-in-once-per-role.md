---
title: Sign in once per role, in a setup project
impact: MEDIUM
tags: data-and-auth
check: review
---

## Sign in once per role, in a setup project

**Impact: MEDIUM**

A `*.setup.ts` project signs in and saves `storageState`; specs depend on it and start signed in. Clicking through sign-in in every test is slow and tests the sign-in page a hundred times.

**Incorrect:**

```ts
test.beforeEach(async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("admin@example.test");
  // ...
});
```

**Correct:**

```ts
// playwright.config.ts
{ name: "chromium", use: { storageState: "tests/e2e/.auth/admin.json" }, dependencies: ["setup"] }
// a read-only spec
test.use({ storageState: "tests/e2e/.auth/readonly.json" });
```
