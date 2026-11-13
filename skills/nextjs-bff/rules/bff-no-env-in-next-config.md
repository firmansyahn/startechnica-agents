---
title: next.config stays free of environment reads
impact: HIGH
tags: config
check: review
---

## next.config stays free of environment reads

**Impact: HIGH**

Next evaluates `next.config.*` at build and again at start, with different environments. Rewrites, headers and redirects that depend on the environment go in `proxy.ts`, which runs per request.

**Incorrect:**

```ts
async rewrites() { return [{ source: "/api/:path*", destination: `${process.env.BACKEND_URL}/api/:path*` }]; }
```

**Correct:**

```ts
// proxy.ts
if (BACKEND_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.rewrite(new URL(pathname + search, backendUrl()));
```
