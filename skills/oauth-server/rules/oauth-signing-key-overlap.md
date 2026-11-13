---
title: Rotate signing keys with an overlap in JWKS
impact: MEDIUM
tags: jwks, keys, id-token
check: test
---

## Rotate signing keys with an overlap in JWKS

**Impact: MEDIUM** (tokens signed just before a rotation fail to verify, or a leaked key can't be retired)

Signing keys live in storage (private key encrypted or in a KMS) with activation and retirement times. The newest active key signs, every JWT carries its `kid`, and JWKS publishes every active key plus each retired one until the tokens it signed have expired. Rotate on a schedule and on suspicion.

**Incorrect:**

```go
key := loadKeyFromFile("signing.pem")   // one key, forever; no kid
```

**Correct:**

```go
signer := keys.NewestActive(ctx)        // kid in the header
jwks := keys.Published(ctx)             // active + retired within the longest token lifetime
```

**How to check:** tests: after a rotation, an ID token signed with the previous key still verifies against JWKS until its expiry, and the previous key leaves JWKS after that.
