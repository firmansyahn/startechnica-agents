---
title: The theme script passes the CSP by nonce or hash
impact: HIGH
tags: headers
check: review
---

## The theme script passes the CSP by nonce or hash

**Impact: HIGH**

The before-paint theme script (`nextjs-ui`) is inline. next-themes gets `nonce={nonce}`; a constant mode script gets the nonce, or its `sha256-…` hash computed by a test from the same constant. Disabling the CSP "for the theme script" is never the fix.

**Correct:**

```tsx
const nonce = (await headers()).get("x-nonce") ?? undefined;
return <ThemeProvider attribute="class" nonce={nonce}>{children}</ThemeProvider>;
```
