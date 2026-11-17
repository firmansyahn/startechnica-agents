---
title: Run every call with the caller's context and a deadline
impact: MEDIUM
tags: clickhouse, context, timeouts
check: scan
---

## Run every call with the caller's context and a deadline

**Impact: MEDIUM** (a query under `context.Background()` keeps running on the server after the client gave up, holding memory and a query slot, and a slow query never times out)

Pass the request's or job's context to `Query`, `QueryRow`, `Select`, `Exec`, `PrepareBatch` and `Ping`, with a deadline set at the store or above it. The driver sends a deadline longer than a second to the server as `max_execution_time`, so the server stops the query too. Per-query settings go on the same context with `clickhouse.Context(ctx, clickhouse.WithSettings(...))`.

**Incorrect:**

```go
func (s *Store) CountOrders(day time.Time) (uint64, error) {
	var n uint64
	err := s.conn.QueryRow(context.Background(),
		"SELECT count() FROM orders WHERE toDate(created_at) = ?", day).Scan(&n)
	return n, err
}
```

**Correct:**

```go
func (s *Store) CountOrders(ctx context.Context, day time.Time) (uint64, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var n uint64
	if err := s.conn.QueryRow(ctx,
		"SELECT count() FROM orders WHERE created_at >= ? AND created_at < ?",
		day, day.AddDate(0, 0, 1)).Scan(&n); err != nil {
		return 0, fmt.Errorf("count orders on %s: %w", day.Format(time.DateOnly), err)
	}
	return n, nil
}
```

The writer's flush, which runs in its own goroutine, gets a context from the writer's lifetime with a per-flush timeout ([go-concurrency](../../go-concurrency/SKILL.md)).

**How to check:** `scripts/scan.sh` flags clickhouse-go calls whose first argument is `context.Background()` or `context.TODO()`. In review, check that a deadline is set somewhere on the path.
