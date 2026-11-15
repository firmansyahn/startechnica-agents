---
title: Store tokens, codes and secrets only as hashes
impact: HIGH
tags: tokens, storage, secrets
check: test, scan (candidates), lint (gosec G404), review
---

## Store tokens, codes and secrets only as hashes

**Impact: HIGH** (a database dump or backup hands out working tokens)

Access tokens, refresh tokens, codes and client secrets are 32 random bytes from a CSPRNG with a recognisable prefix (`<app>_at_`, `<app>_rt_`); the database keeps only their SHA-256, indexed. Access tokens are opaque by default so one lookup also proves the grant, session and client are still live; choose JWT access tokens only when resource servers must verify offline, and keep them to minutes.

**Incorrect:**

```sql
INSERT INTO oauth_tokens (token, subject_id, expires_at) VALUES ($1, $2, $3)
```

**Correct:**

```sql
INSERT INTO oauth_tokens (hash, kind, family_id, client_id, subject_id, resource, scopes, expires_at)
VALUES (sha256($1), 'access', $2, $3, $4, $5, $6, $7)
```

**How to check:** `assets/oauth_flow_test.go` (`TestOAuthTokensStoredHashed`) runs a flow and a refresh, reads every row of the token, code, grant, session and client tables, and fails when one holds an issued code, token or the client secret in clear, or a token lacks its prefix. `scripts/scan.sh` lists migration columns named like a token, code or secret with a text or bytes type (confirm: a country `code` isn't a secret) and `math/rand` in files that make tokens; golangci-lint `gosec` G404 flags `math/rand` exactly. In review: the secret scanners know the prefixes, and the choice of JWT access tokens.
