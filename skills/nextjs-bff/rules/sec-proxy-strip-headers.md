---
title: Forward allow-listed headers only, and strip Set-Cookie from replies
impact: CRITICAL
tags: bff, proxy, cookies, headers
check: test
---

## Forward allow-listed headers only, and strip Set-Cookie from replies

**Impact: CRITICAL** (session cookies leak to the backend, or a backend cookie lands on the app's origin)

The proxy builds a fresh header set: an allow-list from the browser (accept, content-type, the scope header, request id) plus `Authorization: Bearer` from the session. The reply drops `Set-Cookie`, hop-by-hop headers and `WWW-Authenticate`.

**Incorrect:**

```ts
return fetch(backendUrl, { method: req.method, headers: req.headers, body: req.body });   // forwards Cookie
```

**Correct:**

```ts
const res = await fetch(backendUrl, { method, headers: requestHeaders(req.headers, access, requestId), body });
return new Response(res.body, { status: res.status, headers: replyHeaders(res.headers) });   // no set-cookie
```

**How to check:** a test that sends a `Cookie` and asserts the backend never sees it, and one where the backend replies with `Set-Cookie` and the browser's reply has none.
