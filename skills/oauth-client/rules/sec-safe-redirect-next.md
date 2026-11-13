---
title: Validate return-to URLs as same-site paths
impact: CRITICAL
tags: auth, redirects, open-redirect
check: test
---

## Validate return-to URLs as same-site paths

**Impact: CRITICAL** (open redirect: a sign-in link that lands the user on an attacker's page)

A `next`/`returnTo`/`callbackUrl` value is accepted only as a relative path starting with a single `/`, with no `//`, no backslash and no scheme, and never pointing at the sign-in or callback routes themselves. Check it when storing and again when redirecting.

**Incorrect:**

```ts
redirect(searchParams.get("next") ?? "/");
```

**Correct:**

```ts
redirect(safeNext(searchParams.get("next")));   // "/" for "//evil.com", "/\evil.com", "https://...", the callback path
```

**How to check:** tests for `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:alert(1)` and the callback path, each falling back to the default page. Review every `redirect(` / `NextResponse.redirect(` fed from a query parameter.
