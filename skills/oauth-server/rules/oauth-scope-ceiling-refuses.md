---
title: Refuse scopes beyond the client's ceiling instead of trimming them
impact: MEDIUM
tags: scopes, registration
check: test
---

## Refuse scopes beyond the client's ceiling instead of trimming them

**Impact: MEDIUM** (a client gets less than it asked for without knowing, or more than its registration allows)

Each client is registered with the most it may ever request. An authorization request for a scope outside that ceiling is refused with `invalid_scope`, not silently trimmed, so the client's configuration error shows at once. The token reply's `scope` always states what was granted.

**Incorrect:**

```go
granted := intersect(req.Scopes, client.Ceiling)   // the client never learns
```

**Correct:**

```go
if extra := minus(req.Scopes, client.Ceiling); len(extra) > 0 {
	return oauthErr("invalid_scope", "not allowed for this client: "+strings.Join(extra, " "))
}
```

**How to check:** tests: a request for a scope outside the ceiling answers `invalid_scope`; the token reply's `scope` matches what was granted.
