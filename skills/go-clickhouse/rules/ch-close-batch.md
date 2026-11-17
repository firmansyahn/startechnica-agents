---
title: Defer Close right after PrepareBatch
impact: HIGH
tags: clickhouse, inserts, resources
check: scan
---

## Defer Close right after PrepareBatch

**Impact: HIGH** (a batch holds a pooled connection from `PrepareBatch` until `Send`, `Abort` or `Close`; returning early on an `Append` error leaks it, and enough leaks block every query on the pool)

`defer batch.Close()` right after the error check of `PrepareBatch`. `Close` after a successful `Send` does nothing, so it is safe on every path; it doesn't send buffered rows, so `Send` stays the last step.

**Incorrect:**

```go
batch, err := s.conn.PrepareBatch(ctx, "INSERT INTO orders")
if err != nil {
	return err
}
for _, o := range orders {
	if err := batch.AppendStruct(&o); err != nil {
		return err // the batch and its connection are never released
	}
}
return batch.Send()
```

**Correct:**

```go
batch, err := s.conn.PrepareBatch(ctx, "INSERT INTO orders")
if err != nil {
	return fmt.Errorf("prepare orders batch: %w", err)
}
defer batch.Close()
for i := range orders {
	if err := batch.AppendStruct(&orders[i]); err != nil {
		return fmt.Errorf("append order %s: %w", orders[i].ID, err)
	}
}
if err := batch.Send(); err != nil {
	return fmt.Errorf("send %d orders: %w", len(orders), err)
}
return nil
```

**How to check:** `scripts/scan.sh` flags `batch, err := ….PrepareBatch(` with no deferred `Close`/`Abort` before the function ends, unless the batch is handed on or returned.
