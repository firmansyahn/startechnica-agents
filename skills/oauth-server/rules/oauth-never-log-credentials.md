---
title: Never log codes, tokens, secrets, verifiers or passwords
impact: HIGH
tags: logging, secrets
check: test, scan (candidates), review
---

## Never log codes, tokens, secrets, verifiers or passwords

**Impact: HIGH** (anyone who can read the logs can sign in as the users in them)

Logs for the authorization server name the client, subject, grant type, result and request id. They never contain an authorization code, access or refresh token, client secret, PKCE verifier, password or the full request body or query of `/oauth2/token` and `/oauth2/authorize`.

**Incorrect:**

```go
log.Info("token request", "form", r.Form)   // code, code_verifier, client_secret
```

**Correct:**

```go
log.Info("token request", "client", clientID, "grant", grantType, "result", result, "request_id", reqID)
```

**How to check:** `assets/oauth_flow_test.go` (`TestOAuthNoCredentialsInLogs`) runs authorize, sign-in, code exchange, refresh, revocation and three refusals (a reused code, a wrong verifier, a wrong client secret) with the logs captured, and fails when any issued code, token, the client secret, a verifier or the password appears in them; it is exact for the paths it runs. `scripts/scan.sh` lists log calls carrying `r.Form`, `r.PostForm`, the URL or query, the body or a credential field, and `httputil.DumpRequest`; run `go-security`'s scan too (`sec-no-secrets-in-logs`). In review: error paths the test doesn't run, and logs written outside the process (a proxy's access log recording query strings).
