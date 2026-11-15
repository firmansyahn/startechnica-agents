---
title: Headers and CSP are checked on a real page
impact: MEDIUM
tags: scope-and-ci
check: scan, review
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

**How to check:** `scripts/scan.sh` reports a suite in which no `*.spec.ts` both reads the `content-security-policy` header and listens for `Content Security Policy` console messages; `nextjs-security`'s `assets/e2e/security-headers.spec.ts` is the spec to copy (it also asserts framing, exact origins and the theme script per theme). It shows the spec exists, not that it covers every header and page; review that against `nextjs-security`.
