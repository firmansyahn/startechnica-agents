---
title: Refresh ahead of expiry, and once after a guard 401
impact: CRITICAL
tags: session
check: review
---

## Refresh ahead of expiry, and once after a guard 401

**Impact: CRITICAL**

Refresh about 60 s before the access token expires, and once after a backend 401 that carries `WWW-Authenticate: Bearer` (the guard refusing the token). A handler's own 401 without that header ("wrong current password") is passed through, not treated as an expired token.

**Incorrect:**

```ts
if (res.status === 401) { await refresh(); return send(); }
```

**Correct:**

```ts
if (res.status === 401 && /^Bearer\b/i.test(res.headers.get("www-authenticate") ?? "")) {
  if (!(await refresh(sessionId))) return signedOut();
  return send();
}
```
