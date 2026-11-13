---
title: Let scopes narrow what a role allows, never widen it
impact: CRITICAL
tags: scopes, authorization, roles
check: test
---

## Let scopes narrow what a role allows, never widen it

**Impact: CRITICAL** (a token with a broad scope reaches data the user's own role forbids)

The route guard checks the token's scopes against the route first, then runs the product's normal role or permission check for the user. A scope is a ceiling on what the client may do for the user; it never grants a permission the user lacks. Consent lists only scopes the user's role can use.

**Incorrect:**

```go
if caller.HasScope("orders:write") {
	return next(w, r)   // skips the role check
}
```

**Correct:**

```go
if !caller.Scopes.Covers(route.App, route.Resource, r.Method) {
	return forbidden(w)
}
if !roles.Allows(caller.Subject, route.Permission) {
	return forbidden(w)
}
```

**How to check:** tests: a user whose role can't edit orders is refused `PATCH /orders/1` even with an `orders:write` token; a user who can is refused with only `orders:read`.
