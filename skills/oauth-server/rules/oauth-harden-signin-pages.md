---
title: Keep the sign-in and consent pages unframeable and check Origin on their POSTs
impact: HIGH
tags: clickjacking, csrf, cookies
check: test
---

## Keep the sign-in and consent pages unframeable and check Origin on their POSTs

**Impact: HIGH** (a hidden frame tricks the user into approving access, or a cross-site form signs them in or out)

Sign-in, consent and logout pages send `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. Every state-changing POST a browser makes to the server (sign-in, consent, logout, a token request that reads a cookie) refuses an `Origin` that is present and not the public origin. The sign-in session cookie is host-only, `Secure`, `HttpOnly`, `SameSite=Strict` (or `Lax` where a redirect must carry it), with a `__Host-` or `__Secure-` name.

**Incorrect:**

```go
http.SetCookie(w, &http.Cookie{Name: "session", Value: id})
```

**Correct:**

```go
http.SetCookie(w, &http.Cookie{Name: "__Host-signin", Value: handle, Path: "/",
	Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode})
w.Header().Set("Content-Security-Policy", "frame-ancestors 'none'")
```

**How to check:** tests: the sign-in and consent responses carry the framing headers; a POST with `Origin: https://evil.example` is refused; the cookie attributes match.
