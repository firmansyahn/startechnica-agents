---
title: Serve each path from one router only
impact: HIGH
tags: router, app-router, pages-router
check: scan
---

## Serve each path from one router only

**Impact: HIGH** (a path defined in both pages/ and app/ fails the build ("Conflicting app and page file"))

The commit that adds `app/<route>/page.tsx` deletes `pages/<route>.tsx` (or `pages/<route>/index.tsx`). The same goes for `app/api/<route>/route.ts` and `pages/api/<route>.ts`. Parameter names don't matter: `/customers/[id]` and `/customers/[slug]` are the same path. Route groups `(name)` and slots `@name` don't add a URL segment.

**Incorrect:**

```text
pages/customers/[id].tsx
app/customers/[customerId]/page.tsx   # same path as the pages/ file
```

**Correct:**

```text
app/customers/[customerId]/page.tsx   # pages/customers/[id].tsx deleted in the same commit
```

**How to check:** `scripts/routes.sh --conflicts` (and `scripts/scan.sh`) lists every path both routers define.
