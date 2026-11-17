---
title: Wait for the flush when using async inserts
impact: HIGH
tags: clickhouse, inserts, durability
check: scan
---

## Wait for the flush when using async inserts

**Impact: HIGH** (with `wait_for_async_insert=0` the server acknowledges rows it has only buffered: a parse error, a restart or a full disk loses them, and the error shows up only in server logs)

Async inserts let many small INSERTs share one part, but only with `wait_for_async_insert=1` does the call return after the data is written, with its error. In clickhouse-go that is `clickhouse.WithAsync(true)` (the argument is `wait`); `WithAsync(false)` and the deprecated `AsyncInsert(ctx, q, false, ...)` are fire-and-forget. Upstream: `insert-async-small-batches` in [clickhouse-best-practices](../../clickhouse-best-practices/SKILL.md).

**Incorrect:**

```go
ctx = clickhouse.Context(ctx, clickhouse.WithAsync(false)) // wait=false: errors are lost
err := s.conn.Exec(ctx, "INSERT INTO page_views (ts, site_id, path) VALUES (?, ?, ?)", ts, siteID, path)
```

**Correct:**

```go
ctx = clickhouse.Context(ctx, clickhouse.WithAsync(true)) // async_insert=1, wait_for_async_insert=1
if err := s.conn.Exec(ctx, "INSERT INTO page_views (ts, site_id, path) VALUES (?, ?, ?)", ts, siteID, path); err != nil {
	return fmt.Errorf("insert page view: %w", err)
}
```

The same goes for settings in `Options.Settings`, a DSN or the server user profile: `wait_for_async_insert` stays `1`.

**How to check:** `scripts/scan.sh` flags `WithAsync(false)`, `WithStdAsync(false)`, `AsyncInsert(…, false…)` and `wait_for_async_insert` set to `0` in Go files.
