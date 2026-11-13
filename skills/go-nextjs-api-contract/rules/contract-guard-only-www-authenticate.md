---
title: Only the guard's 401 carries WWW-Authenticate
impact: HIGH
tags: auth, 401, bff
check: test
---

## Only the guard's 401 carries WWW-Authenticate

**Impact: HIGH** (the BFF refreshes tokens on that header, so a handler's own 401 triggers pointless refreshes or loops)

The auth middleware's refusal (missing, expired or revoked token) sends `WWW-Authenticate: Bearer error="invalid_token"`; a handler's own 401 (wrong current password, wrong one-time code) doesn't. The BFF refreshes only on the first.

**Incorrect:**

```go
if !checkPassword(u, in.Current) {
	httpx.Unauthorized(w)              // the guard's helper: adds WWW-Authenticate, triggers a token refresh
	return
}
```

**Correct:**

```go
if !checkPassword(u, in.Current) {
	httpx.Fail(w, http.StatusUnauthorized, "The current password is wrong", httpx.FieldErrors{"current_password": {"Wrong password"}})
	return
}
```

**How to check:** tests assert the guard's 401 has `WWW-Authenticate: Bearer` and a handler's own 401 (wrong password) doesn't.
