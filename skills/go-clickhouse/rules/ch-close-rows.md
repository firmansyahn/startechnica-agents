---
title: Close rows and check rows.Err
impact: HIGH
tags: clickhouse, resources, errors
check: scan
---

## Close rows and check rows.Err

**Impact: HIGH** (unclosed rows keep a pooled connection busy until the pool runs out and every query waits; an unchecked `rows.Err` returns a truncated result, cut off by a server exception or a timeout, as if it were complete)

Prefer `conn.Select(ctx, &dest, query, args...)`, which scans into a slice of structs and closes the rows. When streaming with `Query`, `defer rows.Close()` right after the error check and check `rows.Err()` after the loop: ClickHouse sends an exception mid-stream when a query fails after it started returning blocks.

**Incorrect:**

```go
rows, err := s.conn.Query(ctx, "SELECT order_id, total FROM orders WHERE customer_id = ?", customerID)
if err != nil {
	return nil, err
}
for rows.Next() {
	var o Order
	if err := rows.ScanStruct(&o); err != nil {
		return nil, err
	}
	out = append(out, o)
}
return out, nil
```

**Correct:**

```go
rows, err := s.conn.Query(ctx, "SELECT order_id, total FROM orders WHERE customer_id = ?", customerID)
if err != nil {
	return nil, fmt.Errorf("query orders: %w", err)
}
defer rows.Close()
for rows.Next() {
	var o Order
	if err := rows.ScanStruct(&o); err != nil {
		return nil, fmt.Errorf("scan order: %w", err)
	}
	out = append(out, o)
}
if err := rows.Err(); err != nil {
	return nil, fmt.Errorf("read orders: %w", err)
}
return out, nil
```

**How to check:** `scripts/scan.sh` flags `rows, err := ….Query(` in clickhouse-go files with no `rows.Close()` before the function ends, unless the rows are handed on or returned.
