---
title: The matcher is a literal, kept in step with the prefix list
impact: HIGH
tags: config
check: review
---

## The matcher is a literal, kept in step with the prefix list

**Impact: HIGH**

`config.matcher` must be a constant Next can analyse at build time; a variable is ignored. Keep it in step with the prefix list the code checks, with a test that compares them.

**Incorrect:**

```ts
export const config = { matcher: BACKEND_PREFIXES.map((p) => `${p}:path*`) };
```

**Correct:**

```ts
export const config = { matcher: ["/api/:path*", "/oauth2/:path*", "/.well-known/:path*", "/admin/:path*"] };
// proxy.test.ts: expect(config.matcher).toEqual(expectedMatcher(BACKEND_PREFIXES, GATED_PREFIXES))
```
