---
title: Send the security headers on every response, with x-powered-by off
impact: MEDIUM
tags: headers, hsts, framing, nosniff
check: test
---

## Send the security headers on every response, with x-powered-by off

**Impact: MEDIUM** (clickjacking, MIME sniffing, referrer leaks and downgrade attacks stay open)

`next.config` `headers()` sets, for `/:path*`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Frame-Options: DENY` (with `frame-ancestors 'none'` in the CSP), and HSTS where every host is HTTPS. `poweredByHeader: false`. A page meant to be embedded gets its own narrower rule, not a site-wide relaxation.

**Incorrect:**

```ts
const nextConfig = {
  async headers() { return [{ source: "/", headers: security }]; },   // only the home page; x-powered-by still on
};
```

**Correct:**

```ts
const nextConfig = {
  poweredByHeader: false,
  async headers() { return [{ source: "/:path*", headers: security }]; },
};
```

**How to check:** an end-to-end test requests a page, a route handler and a static asset of the production build and asserts the headers (and that `x-powered-by` is absent). In review, check the `source` pattern covers every path.
