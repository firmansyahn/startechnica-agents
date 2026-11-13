---
title: Scope locators to a region before picking inside it
impact: LOW
tags: locators
check: review
---

## Scope locators to a region before picking inside it

**Impact: LOW**

Pick the dialog, the row, the navigation or the form first, then the control inside it, so "Save" in the drawer isn't confused with "Save" on the page.

**Correct:**

```ts
const drawer = page.getByRole("dialog", { name: "Edit customer" });
await drawer.getByLabel("Name").fill("North");
await drawer.getByRole("button", { name: "Save" }).click();
await expect(drawer).toBeHidden();
```
