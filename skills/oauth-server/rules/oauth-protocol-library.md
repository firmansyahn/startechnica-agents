---
title: Let a certified library run the protocol
impact: HIGH
tags: library, protocol
check: review
---

## Let a certified library run the protocol

**Impact: HIGH** (a hand-rolled token endpoint misses checks the specs require, and nobody notices until it is exploited)

The token endpoint, PKCE verification, code exchange and ID token signing come from a maintained, OpenID-certified library (Go: `zitadel/oidc` `op` or `ory/fosite`; Node: `oidc-provider`; Java: Spring Authorization Server; .NET: OpenIddict), pinned to a version. The product writes the storage the library runs on, the policy (who, which client, which scopes, how long) and the pages.

**Incorrect:**

```go
func token(w http.ResponseWriter, r *http.Request) {
	code := r.FormValue("code")
	row := store.Code(code)                  // no PKCE check, no client binding,
	writeJSON(w, issueTokens(row.Subject))   // no single-use, no redirect check
}
```

**Correct:**

```go
provider, err := op.NewProvider(cfg, storage, op.StaticIssuer(cfg.Issuer)) // the library runs /token
// storage implements the library's interfaces; policy lives in the domain package
mux.Handle("/oauth2/", http.StripPrefix("/oauth2", provider))
```

**How to check:** in review, no handler of its own parses `grant_type`, compares a `code_verifier` or signs an ID token; the library's version is pinned in the lockfile.
