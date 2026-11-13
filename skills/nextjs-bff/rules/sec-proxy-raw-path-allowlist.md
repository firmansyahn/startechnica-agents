---
title: Check the raw path against an allow-list before proxying
impact: CRITICAL
tags: bff, proxy, path-traversal
check: test
---

## Check the raw path against an allow-list before proxying

**Impact: CRITICAL** (a crafted path reaches a backend route the user shouldn't, with their token)

The BFF proxy turns a cookie into a bearer token. It maps only allow-listed first segments, works on the raw (undecoded) pathname, and refuses dot segments, encoded slashes or dots, backslashes, double encoding and control characters.

**Incorrect:**

```ts
const path = decodeURIComponent(new URL(req.url).pathname).replace("/app/api/", "");
return forward(`${BACKEND}/api/v1/${path}`);
```

**Correct:**

```ts
const backendPath = backendPathFor(new URL(req.url).pathname);   // raw path; null when refused
if (!backendPath) return failure(404, "Not found");
```

**How to check:** a test per refused spelling (`..`, `%2e%2e`, `%2f`, `\`, `%25`, unknown namespace) asserting 404 and no backend call. Review any route handler that builds a backend URL from the request path.
