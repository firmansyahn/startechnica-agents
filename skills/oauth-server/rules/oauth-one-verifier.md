---
title: Verify bearer tokens in one function for every API surface
impact: HIGH
tags: verifier, resource-server, revocation
check: test, scan (candidates), review
---

## Verify bearer tokens in one function for every API surface

**Impact: HIGH** (one surface forgets the revocation, expiry or audience check the others have)

One verifier turns `Authorization: Bearer <token>` into a caller (subject, tenant, client, scopes): it looks up the hash and refuses an unknown, expired or revoked token, a revoked grant, an ended session, a disabled client or subject, or a token for another resource. Every API surface calls it, and every refusal answers the same `401` with `WWW-Authenticate: Bearer resource_metadata="<url>"`.

**Incorrect:**

```go
// public API
tok := store.Token(hash(bearer)); if tok.ExpiresAt.Before(now) { ... }
// admin API: its own copy, without the revocation check
```

**Correct:**

```go
caller, err := oauth.Verify(ctx, bearer, ResourcePublicAPI) // the same function on every surface
if err != nil {
	unauthorized(w, metadataURL)   // same 401 whichever check failed
	return
}
```

**How to check:** `assets/oauth_flow_test.go` (`TestOAuthOneVerifierEverySurface`) gets a token for each API surface, checks it is accepted, then revokes it (and, in separate cases, ends the session and disables the client) and checks every surface answers 401 with `WWW-Authenticate: Bearer resource_metadata=`, the same header for each refused token, and the same for an unknown or missing token. `scripts/scan.sh` lists code reading the `Authorization` header, cutting a `Bearer ` prefix or querying the token tables outside `VERIFIER_DIRS` (the verifier and the library's storage adapter). In review: surfaces missing from the test's list.
