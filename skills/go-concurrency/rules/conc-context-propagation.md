---
title: Pass the caller's context; create root contexts only at the root
impact: HIGH
tags: concurrency, context, cancellation
check: scan, lint (contextcheck)
---

## Pass the caller's context; create root contexts only at the root

**Impact: HIGH** (a cancelled request keeps running its queries and calls; shutdown waits on work nobody can stop; deadlines and trace ids are lost)

Functions that do I/O take `ctx context.Context` as the first parameter and pass it on. `context.Background()` appears only in `main`/the composition root, in tests (`t.Context()`), and in code that deliberately outlives a request (an audit write after the response); that last case uses `context.WithoutCancel(ctx)` so values like the request id survive. Never store a context in a struct.

**Incorrect:**

```go
func (s *Service) Disconnect(ctx context.Context, id string) error {
	sess, err := s.store.Session(context.Background(), id)
	// ...
}
```

**Correct:**

```go
func (s *Service) Disconnect(ctx context.Context, id string) error {
	sess, err := s.store.Session(ctx, id)
	// ...
	go s.audit.Record(context.WithoutCancel(ctx), "session.disconnect", id) // owned by the audit writer's queue
}
```

**How to check:** `scripts/scan.sh` flags `context.Background()`/`context.TODO()` outside `package main`, tests and the root directories (`CTX_ROOT_DIRS`, default `cmd internal/app`). `contextcheck` finds functions that drop a context they were given.
