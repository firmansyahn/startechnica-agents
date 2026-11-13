---
title: Answer refusals uniformly so endpoints don't reveal what exists
impact: MEDIUM
tags: errors, enumeration, revocation
check: test
---

## Answer refusals uniformly so endpoints don't reveal what exists

**Impact: MEDIUM** (an attacker learns which accounts, tokens or clients are valid)

Revocation answers `200` for an unknown or already revoked token (RFC 7009). Introspection answers `{"active": false}` for anything not valid, without a reason, and only to authenticated confidential clients. Sign-in gives one message for an unknown account and a wrong password. Errors use the RFC 6749 codes.

**Incorrect:**

```go
if tok == nil {
	http.Error(w, "token not found", http.StatusNotFound)
}
```

**Correct:**

```go
if tok == nil || tok.Revoked() {
	w.WriteHeader(http.StatusOK)   // the same as a successful revoke
	return
}
```

**How to check:** tests: revoking a random string answers 200; introspecting an expired, revoked or random token gives the same `{"active": false}`; sign-in with an unknown account and with a wrong password give the same reply.
