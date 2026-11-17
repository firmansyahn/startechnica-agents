---
title: Build one Redis client per process and close it on shutdown
impact: HIGH
tags: redis, connections, pool, lifecycle
check: scan, review
---

## Build one Redis client per process and close it on shutdown

**Impact: HIGH** (a client per request opens a new pool and TCP/TLS handshake each time, exhausts `maxclients` and file descriptors under load, and leaks connections that are never closed)

A go-redis client is a connection pool that is safe for concurrent use. Build it once at the root (in the Platform package that owns Redis), hand it to constructors, and `Close` it after the HTTP server and the workers have stopped. Never build one inside a handler, a method or a loop, and never close it from code that didn't create it.

**Incorrect:**

```go
func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
	rdb := redis.NewClient(&redis.Options{Addr: h.addr}) // new pool per request, never closed
	v, err := rdb.Get(r.Context(), "orders:order:"+r.PathValue("id")).Result()
	// ...
}
```

**Correct:**

```go
func run(ctx context.Context, cfg config.Config, log *zap.Logger) error {
	rdb, err := cache.New(ctx, cfg.Redis, log) // one client, built from the redis block
	if err != nil {
		return err
	}
	defer rdb.Close() // runs after srv.Shutdown and the workers have returned

	orders := order.NewService(store, cache.NewOrders(rdb, cfg.Redis.KeyPrefix), log)
	// ...
}
```

**How to check:** `scripts/scan.sh` flags `redis.New(Client|ClusterClient|FailoverClient|FailoverClusterClient|UniversalClient)(` and `redis.NewRing(` inside a function whose name doesn't start with `New`, `Open` or `Connect` and isn't `main` or `run`, and a client built in `main` or `run` in a file that never calls `Close()`. In review: a client stored in a package-level variable, or closed by a component that received it.
