---
title: The matcher is a literal, kept in step with the prefix list
impact: HIGH
tags: config
check: eslint, review
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags, in `proxy.ts` and `middleware.ts` (at the root or in `src/`), a `config.matcher` that isn't a literal string or an array of literal strings and matcher objects (a template literal counts as computed: write it as a plain string). Left to review: the test that compares the matcher with the prefix list (rule `bff-test-matcher-prefixes`).
