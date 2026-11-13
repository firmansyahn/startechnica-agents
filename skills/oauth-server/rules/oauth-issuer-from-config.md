---
title: Take the issuer and metadata URLs from configuration
impact: HIGH
tags: issuer, discovery, host-header
check: test
---

## Take the issuer and metadata URLs from configuration

**Impact: HIGH** (a forged Host header makes discovery point clients at an attacker's endpoints)

The issuer and every URL in discovery, protected-resource metadata, `WWW-Authenticate` and emails come from the configured public URL. `Host`, `X-Forwarded-Host` and `X-Forwarded-Proto` never shape them.

**Incorrect:**

```go
issuer := "https://" + r.Host
```

**Correct:**

```go
issuer := cfg.PublicURL   // https://auth.example.com, set at deploy
```

**How to check:** tests: request discovery with `Host: evil.example` and `X-Forwarded-Host: evil.example`; every URL in the reply still starts with the configured issuer.
