---
title: Allow scripts by a per-request nonce or a hash, never by 'unsafe-inline'
impact: HIGH
tags: csp, nonce, headers, xss
check: test
---

## Allow scripts by a per-request nonce or a hash, never by 'unsafe-inline'

**Impact: HIGH** (any injected script runs: the CSP stops nothing)

`script-src` uses `'nonce-<value>' 'strict-dynamic'` with a fresh random nonce per request, set in `proxy.ts` on the request header (Next reads it there) and on the response; static pages can use hashes instead. `'unsafe-inline'` in `script-src`, a constant nonce, or `'unsafe-eval'` outside development defeats the policy.

**Incorrect:**

```ts
const NONCE = process.env.CSP_NONCE;   // the same for every page view
const csp = `script-src 'self' 'unsafe-inline' 'nonce-${NONCE}'`;
```

**Correct:**

```ts
const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
const csp = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`;
requestHeaders.set("Content-Security-Policy", csp);
response.headers.set("Content-Security-Policy", csp);
```

**How to check:** an end-to-end test loads a real page of the production build and asserts the `Content-Security-Policy` header has a nonce or hash, no `'unsafe-inline'`/`'unsafe-eval'` in `script-src`, and a different nonce on a second request (`e2e-check-headers-csp`). In review, look for a constant nonce and for inline `<script>` tags without `nonce`.
