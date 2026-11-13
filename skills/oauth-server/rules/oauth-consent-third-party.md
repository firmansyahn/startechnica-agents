---
title: Ask consent for third-party and MCP clients, and let users revoke it
impact: HIGH
tags: consent, third-party, mcp
check: test
---

## Ask consent for third-party and MCP clients, and let users revoke it

**Impact: HIGH** (an app the user never approved acts on their account)

Third-party and MCP clients show a consent page whenever they ask for scopes not yet granted: the client's name, owner, redirect host and the requested access in plain words, listing only scopes the user can grant. The approved grant is stored and listed in the user's connected apps, where revoking it revokes its tokens. First-party clients never ask.

**Incorrect:**

```go
if client.Kind != KindService {
	return issueCode(req)   // no consent for anyone
}
```

**Correct:**

```go
if needsConsent(client.Kind) && !grants.Covers(ctx, client.ID, user.ID, req.Scopes) {
	return showConsent(w, req, eligibleScopes(user, req.Scopes))
}
```

**How to check:** tests: a third-party client's first request shows consent, a repeat with the same scopes doesn't, a new scope asks again; revoking the grant in connected apps refuses its tokens.
