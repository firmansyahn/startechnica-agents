---
title: Rotate refresh tokens and revoke the family on reuse
impact: HIGH
tags: refresh, rotation, theft
check: test
---

## Rotate refresh tokens and revoke the family on reuse

**Impact: HIGH** (a stolen refresh token keeps working beside the real client indefinitely)

Every refresh issues a new refresh token in the same family and marks the old one used. A used refresh token presented again revokes the whole family. Only a confidential first-party BFF gets a short grace window (about 30 s) for a retry after a lost reply, and only while the successor is still unused; public clients get none.

**Incorrect:**

```go
func refresh(old Token) (Pair, error) {
	return issuePair(old.Subject)   // the old refresh token stays valid
}
```

**Correct:**

```go
func refresh(ctx context.Context, old Token, client Client) (Pair, error) {
	if old.UsedAt != nil {
		if inGraceWindow(client, old) {
			return reissueRevokingUnusedSuccessor(ctx, old)
		}
		store.RevokeFamily(ctx, old.FamilyID)
		return Pair{}, errInvalidGrant
	}
	return rotate(ctx, old)   // marks old used, same family
}
```

**How to check:** tests: a refresh returns a new refresh token; the old one presented again fails and the new one then fails too; the grace window works only for the BFF client, inside the window, with an unused successor.
