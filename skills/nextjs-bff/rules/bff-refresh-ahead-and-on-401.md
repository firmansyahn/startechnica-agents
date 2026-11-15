---
title: Refresh ahead of expiry, and once after a guard 401
impact: CRITICAL
tags: session
check: test, scan (candidates), review
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

**How to check:** the forwarding test `bff-test-guard-401-refresh` asks for (a guard 401 refreshes once and retries, a handler 401 passes through), plus a fake-clock case: a token that expires in under 60 s is refreshed before the backend call. `scripts/scan.sh` lists `status === 401` checks under `src/api/` with no `www-authenticate` on the same line; one that reads the header on another line is a false hit.
