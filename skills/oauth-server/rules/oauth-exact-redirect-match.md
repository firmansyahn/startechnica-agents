---
title: Match redirect URIs exactly; never redirect to an unknown one
impact: CRITICAL
tags: redirect, authorize, open-redirect
check: test
---

## Match redirect URIs exactly; never redirect to an unknown one

**Impact: CRITICAL** (codes and tokens delivered to an attacker's URL)

The `redirect_uri` is compared by string equality with the client's registered list: no prefix, wildcard, case or trailing-slash tolerance. The one relaxation is RFC 8252's loopback redirect for native clients (`http://127.0.0.1/<path>`, any port). An unknown client or unregistered redirect gets an error page from the server, never a redirect.

**Incorrect:**

```go
if strings.HasPrefix(req.RedirectURI, client.RedirectURIs[0]) {   // https://app.example.com.evil.net
	redirectWithCode(w, req.RedirectURI)
}
http.Redirect(w, r, req.RedirectURI+"?error=invalid_request", http.StatusFound)
```

**Correct:**

```go
if !slices.Contains(client.RedirectURIs, req.RedirectURI) && !nativeLoopback(client, req.RedirectURI) {
	renderError(w, "This sign-in link is not valid.")   // a page, no redirect
	return
}
```

**How to check:** tests for a near-miss redirect (trailing slash, other case, extra query, other port on a web client, a longer host) and an unknown client: each shows the error page and its response has no `Location`.
