---
title: Throttle sign-in by address and by account
impact: HIGH
tags: brute-force, lockout, rate-limit
check: test
---

## Throttle sign-in by address and by account

**Impact: HIGH** (password guessing runs at full speed against every account)

Sign-in attempts are limited per client address and per account name, counted in a store shared by all replicas, with the product's lockout policy on top. The token endpoint has per-client limits. The reply for a throttled, locked or wrong attempt doesn't reveal whether the account exists.

**Incorrect:**

```go
var attempts = map[string]int{}   // per process: each replica counts alone
```

**Correct:**

```go
if err := limiter.Allow(ctx, "signin:ip:"+ip, "signin:user:"+name); err != nil {
	return tooManyAttempts(w)   // counts in the shared store
}
```

**How to check:** tests: past the limit, attempts from one address and attempts at one account are refused; the counters are in the shared store, not process memory.
