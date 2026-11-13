---
title: Headers and CSP are checked on a real page
impact: MEDIUM
tags: scope-and-ci
check: review
---

## Headers and CSP are checked on a real page

**Impact: MEDIUM**

One spec loads a page and asserts the security headers and a CSP with a nonce, and fails on any console message about a Content Security Policy violation (`nextjs-security`).

**Correct:**

```ts
const violations: string[] = [];
page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
const res = await page.goto("/app");
expect(res?.headers()["content-security-policy"]).toMatch(/script-src[^;]*'nonce-/);
expect(res?.headers()["x-content-type-options"]).toBe("nosniff");
await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
expect(violations).toEqual([]);
```
