---
title: next.config stays free of environment reads
impact: HIGH
tags: config
check: eslint, review
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags every `process.env` read in `next.config.*`, including `const { env } = process`. A build-only switch (`ANALYZE`) takes a disable comment with the reason. It misses a module that `next.config` imports and that reads the environment; look for those in review.
