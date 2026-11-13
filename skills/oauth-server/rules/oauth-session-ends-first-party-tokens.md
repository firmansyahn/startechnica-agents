---
title: End first-party tokens with the sign-in session that produced them
impact: MEDIUM
tags: session, sign-out, lifetimes
check: test
---

## End first-party tokens with the sign-in session that produced them

**Impact: MEDIUM** (a signed-out or timed-out user's console keeps working through its refresh token)

Each token records the sign-in session it came from. When that session ends (sign-out, idle or absolute limit), the first-party web tokens issued under it are revoked too, so a first-party client can't outlive the session by refreshing. Third-party, MCP and native grants outlive the browser session and end on revocation, password change, user disablement or refresh reuse.

**Incorrect:**

```go
func signOut(ctx context.Context, s Session) {
	store.DeleteSession(ctx, s.ID)   // its refresh tokens keep refreshing
}
```

**Correct:**

```go
func signOut(ctx context.Context, s Session) {
	store.EndSession(ctx, s.ID)
	store.RevokeFirstPartyTokens(ctx, s.ID)
}
```

**How to check:** tests: after sign-out, the first-party refresh and access tokens from that session are refused while a third-party grant for the same user still works; a password change ends all of the user's grants except service clients'.
