---
title: Offer only the authorization code, refresh and client credentials grants
impact: HIGH
tags: grants, implicit, password
check: test
---

## Offer only the authorization code, refresh and client credentials grants

**Impact: HIGH** (tokens in browser URLs and history, or an app collecting users' passwords)

Users sign in through the authorization code grant with PKCE; tokens renew through refresh; machine clients use client credentials. The implicit grant (`response_type=token`) and the resource-owner password grant are not offered, and the device code grant only when a real input-constrained device needs it. Each client kind allows only its own grants.

**Incorrect:**

```go
ResponseTypes: []string{"code", "token", "id_token token"},
GrantTypes:    []string{"authorization_code", "refresh_token", "password", "client_credentials"},
```

**Correct:**

```go
ResponseTypes: []string{"code"},
GrantTypes:    grantsFor(client.Kind), // web: authorization_code, refresh_token; service: client_credentials
```

**How to check:** tests: `response_type=token` and `grant_type=password` are refused (`unsupported_response_type`, `unsupported_grant_type`); a service client can't use the code grant and a web client can't use client credentials; discovery lists only the allowed values.
