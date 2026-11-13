---
title: Return-to URLs are same-site paths
impact: HIGH
tags: config
check: review
---

## Return-to URLs are same-site paths

**Impact: HIGH**

The `next` parameter carried through sign-in is accepted only as a relative path starting with a single `/`: no `//`, scheme, backslash or encoded variants, and never the sign-in or callback pages themselves. Anything else falls back to the default page.

**Incorrect:**

```ts
return NextResponse.redirect(new URL(searchParams.get("next") ?? "/", req.url));
```

**Correct:**

```ts
return NextResponse.redirect(new URL(safeNext(searchParams.get("next")), publicUrl()));
```

Related: `sec-safe-redirect-next`.
