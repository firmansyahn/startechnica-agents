---
title: The theme script passes the CSP by nonce or hash
impact: HIGH
tags: headers
check: test, scan (candidates)
---

## The theme script passes the CSP by nonce or hash

**Impact: HIGH**

The before-paint theme script (`nextjs-ui`) is inline. next-themes gets `nonce={nonce}`; a constant mode script gets the nonce, or its `sha256-…` hash computed by a test from the same constant. Disabling the CSP "for the theme script" is never the fix.

**Correct:**

```tsx
const nonce = (await headers()).get("x-nonce") ?? undefined;
return <ThemeProvider attribute="class" nonce={nonce}>{children}</ThemeProvider>;
```

**How to check:** `assets/e2e/security-headers.spec.ts` (copy it to `tests/e2e/`) loads the page once per theme in its `THEMES` setting (stored the way the app stores it before the page loads) on the production build, and fails on any CSP violation or when `<html>` doesn't show the theme. When the proxy sets a nonce, `scripts/scan.sh` lists files that render `<ThemeProvider` with no `nonce=` and `<script ... dangerouslySetInnerHTML>` lines without `nonce=` as candidates.
