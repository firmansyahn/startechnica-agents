---
title: Never log codes, tokens, secrets, verifiers or passwords
impact: HIGH
tags: logging, secrets
check: review
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

**How to check:** in review, look at every log call in the OAuth handlers and middleware, and at access-log settings that record query strings; a test can grep captured logs for a known token after a full flow.
