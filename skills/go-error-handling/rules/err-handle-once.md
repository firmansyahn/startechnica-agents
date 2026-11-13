---
title: "Handle each error once: wrap and return, or log and degrade"
impact: MEDIUM
tags: errors, logging
check: scan (candidates)
---

## Handle each error once: wrap and return, or log and degrade

**Impact: MEDIUM** (one failure logs three to five times up the stack, so logs are noisy and the real cause is hard to find)

A function either returns the error (wrapped with context) **or** logs it and carries on with a fallback; never both. The error is logged once, where it is finally handled: the HTTP handler (as a status plus a log line), the worker loop, or `main`.

**Incorrect:**

```go
z, err := s.store.Get(ctx, id)
if err != nil {
	s.log.Error("get customer", zap.Error(err))
	return nil, err
}
```

**Correct:**

```go
z, err := s.store.Get(ctx, id)
if err != nil {
	return nil, fmt.Errorf("get customer %s: %w", id, err)
}

// or, when a fallback is right:
limits, err := s.store.Limits(ctx, id)
if err != nil {
	s.log.Warn("limits unavailable, using defaults", zap.String("customer_id", id), zap.Error(err))
	limits = DefaultLimits
}
```

**How to check:** `scripts/scan.sh` flags a log call that mentions `err` followed within three lines by `return … err`. Logging at a boundary that returns a *different*, client-facing error is fine.
