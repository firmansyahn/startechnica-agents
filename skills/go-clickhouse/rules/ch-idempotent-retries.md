---
title: Retry an insert with the same rows in the same order
impact: HIGH
tags: clickhouse, inserts, retries, deduplication
check: review
---

## Retry an insert with the same rows in the same order

**Impact: HIGH** (an insert that timed out may have been written; a retry that regroups the rows, or adds new ones, is a different block that deduplication can't recognise, so every row counts twice)

ClickHouse deduplicates a repeated INSERT block on replicated tables (and on `MergeTree` with `non_replicated_deduplication_window` set) only when the block is identical. So a retry resends the batch it already built, unchanged. When the source has a natural key for the batch (a queue partition and offset range, a job and chunk ID), also set `insert_deduplication_token` to it, so even a rebuilt batch is recognised. Tables whose readers can't tolerate duplicates at all use `ReplacingMergeTree` with a version column.

**Incorrect:**

```go
for attempt := 0; attempt < 3; attempt++ {
	rows := w.drain() // takes whatever is buffered now: a different block each time
	if err := w.store.InsertPageViews(ctx, rows); err == nil {
		return nil
	}
}
```

**Correct:**

```go
rows := w.drain() // the batch is fixed once
token := fmt.Sprintf("page_views:%d:%d-%d", partition, firstOffset, lastOffset)
insertCtx := clickhouse.Context(ctx, clickhouse.WithSettings(clickhouse.Settings{
	"insert_deduplication_token": token,
}))
err := retry(ctx, 3, func() error { return w.store.InsertPageViews(insertCtx, rows) })
```

Retry only errors that may be transient (a network error, a timeout, exception codes such as 252 too many parts or 202 too many simultaneous queries), with backoff; a type or parse error fails the same way every time.

**How to check:** review: find each retry around an insert, confirm the rows slice is built before the loop, and check the target table's engine and deduplication settings in its migration.
