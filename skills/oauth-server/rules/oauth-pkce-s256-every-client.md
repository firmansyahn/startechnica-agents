---
title: Require PKCE S256 from every client
impact: CRITICAL
tags: pkce, authorize, token
check: test
---

## Require PKCE S256 from every client

**Impact: CRITICAL** (a stolen authorization code can be exchanged by whoever holds it)

Every authorization request carries `code_challenge` with `code_challenge_method=S256`, confidential clients included; a missing challenge or `plain` is refused at authorize, before any page is shown. The token request must carry the matching `code_verifier`.

**Incorrect:**

```go
if req.CodeChallenge != "" && req.Method != "S256" && req.Method != "plain" {
	return errInvalidRequest
}
// a confidential client may skip PKCE
```

**Correct:**

```go
if req.CodeChallenge == "" || req.Method != "S256" {
	return oauthErr("invalid_request", "PKCE with S256 is required")
}
```

**How to check:** tests: authorize without `code_challenge`, with `code_challenge_method=plain`, and from a confidential client without PKCE all fail; token with a wrong `code_verifier` answers `invalid_grant`.
