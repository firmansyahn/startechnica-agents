---
title: Issue each token for one resource and refuse it everywhere else
impact: CRITICAL
tags: audience, resource, rfc8707
check: test
---

## Issue each token for one resource and refuse it everywhere else

**Impact: CRITICAL** (a token for one API (a third-party app's) works against another (the admin API))

The client names the API with `resource` (RFC 8707); the server checks it against the client kind's resource at authorize and at token, records it on the token, and every API surface refuses a token issued for another resource.

**Incorrect:**

```go
caller, err := verify(ctx, bearer)   // any live token is accepted on every surface
```

**Correct:**

```go
caller, err := verify(ctx, bearer, ResourceAdminAPI)
// verify refuses tokens whose resource differs, with the same 401 as any other refusal
```

**How to check:** tests: a token issued for the public API is refused by the admin API and the MCP endpoint, and the reverse; an authorize request naming a resource the client kind can't have is refused.
