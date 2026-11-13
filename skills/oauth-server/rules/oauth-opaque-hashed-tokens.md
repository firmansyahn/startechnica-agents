---
title: Store tokens, codes and secrets only as hashes
impact: HIGH
tags: tokens, storage, secrets
check: review
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

**How to check:** in review, no column stores a token, code or client secret in clear; the token generator uses `crypto/rand` (or the platform's CSPRNG) and adds the prefix; secret scanners know the prefixes.
