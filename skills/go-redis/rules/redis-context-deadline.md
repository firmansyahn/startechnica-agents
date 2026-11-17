---
title: Run every command with the caller's context and let its deadline apply
impact: HIGH
tags: redis, context, timeouts
check: scan, review
---

## Run every command with the caller's context and let its deadline apply

**Impact: HIGH** (a slow or partitioned Redis holds every request for the full socket timeout, goroutines and pool connections pile up, and a cache that should degrade quietly takes the service down)

Pass the request's `ctx` to every command, never `context.Background()` or `context.TODO()` inside a request. go-redis ignores the context's deadline for socket reads and writes unless `ContextTimeoutEnabled: true` is set (only `ReadTimeout`/`WriteTimeout` apply, 5 s by default), so set it on every client. Keep `DialTimeout`, `ReadTimeout` and `WriteTimeout` set too: background checks run without a context.

**Incorrect:**

```go
rdb := redis.NewClient(&redis.Options{Addr: cfg.Addrs[0]}) // ctx deadlines ignored on the socket

func (c *Sessions) Get(ctx context.Context, id string) (string, error) {
	return c.rdb.Get(context.Background(), c.key(id)).Result() // detached from the request
}
```

**Correct:**

```go
rdb := redis.NewUniversalClient(&redis.UniversalOptions{
	Addrs:                 cfg.Addrs,
	DialTimeout:           cfg.DialTimeout,
	ReadTimeout:           cfg.ReadTimeout,
	WriteTimeout:          cfg.WriteTimeout,
	ContextTimeoutEnabled: true, // the caller's deadline bounds the command
})

func (c *Sessions) Get(ctx context.Context, id string) (string, error) {
	return c.rdb.Get(ctx, c.key(id)).Result()
}
```

**How to check:** `scripts/scan.sh` flags `context.Background()`/`context.TODO()` passed straight to a call on a client-looking receiver (`rdb.`, `c.rdb.`, `client.`, `pipe.`, `tx.`) in files that import go-redis, outside `main` and tests, and every `redis.Options{`, `ClusterOptions{`, `FailoverOptions{` or `UniversalOptions{` literal with no `ContextTimeoutEnabled` in the next 40 lines. In review: options built through `redis.ParseURL` without setting the field afterwards.
