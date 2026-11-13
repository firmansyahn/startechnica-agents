---
title: Use each authorization code once; a replay revokes what it issued
impact: CRITICAL
tags: code, replay, token
check: test
---

## Use each authorization code once; a replay revokes what it issued

**Impact: CRITICAL** (an intercepted or logged code yields a second set of tokens)

A code lives about 60 seconds, is bound to its client, redirect URI and PKCE challenge, and is marked used in the same transaction that issues tokens. A code presented again is refused, and every token issued from it is revoked (RFC 6749 section 4.1.2).

**Incorrect:**

```go
row := store.CodeByHash(hash(code))
if row == nil || time.Now().After(row.ExpiresAt) {
	return errInvalidGrant
}
return issue(row)   // the same code works again
```

**Correct:**

```go
row, err := store.UseCode(ctx, hash(code))   // UPDATE ... SET used_at = now() WHERE used_at IS NULL RETURNING ...
if errors.Is(err, ErrCodeUsed) {
	store.RevokeIssuedFrom(ctx, row.ID)
	return errInvalidGrant
}
```

**How to check:** tests: exchanging a code twice fails the second time and the access token from the first exchange is then refused; a code for another client or redirect, or past its expiry, answers `invalid_grant`.
