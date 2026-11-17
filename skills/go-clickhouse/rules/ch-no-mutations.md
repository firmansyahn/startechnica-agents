---
title: Don't run ALTER UPDATE/DELETE or OPTIMIZE FINAL from service code
impact: HIGH
tags: clickhouse, mutations, schema
check: scan, review
---

## Don't run ALTER UPDATE/DELETE or OPTIMIZE FINAL from service code

**Impact: HIGH** (an `ALTER TABLE … UPDATE/DELETE` is a mutation that rewrites every part it touches in the background; issued per request they queue up, eat disk I/O and CPU, and `OPTIMIZE … FINAL` rewrites whole partitions)

ClickHouse isn't a row store: model a change as a new row. An update is a new version in a `ReplacingMergeTree` (or a sign row in a `CollapsingMergeTree`), a delete is a tombstone version or a TTL, bulk removal is `DROP PARTITION`. A rare, operator-run correction may use a lightweight `DELETE FROM` in a migration or a runbook, not in a request path. Upstream: `insert-mutation-avoid-update`, `insert-mutation-avoid-delete`, `insert-optimize-avoid-final` in [clickhouse-best-practices](../../clickhouse-best-practices/SKILL.md).

**Incorrect:**

```go
func (s *Store) CancelOrder(ctx context.Context, id uuid.UUID) error {
	return s.conn.Exec(ctx, "ALTER TABLE orders UPDATE status = 'cancelled' WHERE order_id = ?", id)
}
```

**Correct:**

```go
// orders: ENGINE = ReplacingMergeTree(version) ORDER BY (customer_id, order_id)
func (s *Store) CancelOrder(ctx context.Context, o Order) error {
	o.Status = "cancelled"
	o.Version = uint64(time.Now().UnixNano())
	return s.insertOrders(ctx, []Order{o}) // through the batched writer on a hot path
}
```

Readers take the latest version with `argMax(status, version) … GROUP BY order_id`, or `FINAL` where exactness matters more than speed.

**How to check:** `scripts/scan.sh` flags `ALTER TABLE … UPDATE`/`DELETE`, `DELETE FROM` and `OPTIMIZE TABLE` in Go strings. In review, look for any per-request change to existing rows.
