---
title: Wait for navigation by asserting the URL
impact: LOW
tags: stability
check: review
---

## Wait for navigation by asserting the URL

**Impact: LOW**

After a click that navigates (a link, a server action that redirects), assert `toHaveURL` and then the new page's content; don't race the old page's elements.

**Correct:**

```ts
await page.getByRole("button", { name: "Create" }).click();
await expect(page).toHaveURL(/\/app\/items\/[\w-]+$/);
await expect(page.getByRole("heading", { level: 1 })).toHaveText("North");
```
