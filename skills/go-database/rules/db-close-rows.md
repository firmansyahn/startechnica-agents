---
title: Close rows and check rows.Err
impact: HIGH
tags: database, resources, errors
check: scan, lint (sqlclosecheck, rowserrcheck)
---

## Close rows and check rows.Err

**Impact: HIGH** (unclosed rows hold a pooled connection until the pool is exhausted and every query hangs; an unchecked `rows.Err` returns a truncated list as if it were complete)

`defer rows.Close()` right after the error check of `Query`, and `rows.Err()` checked after the loop. With pgx, prefer `pgx.CollectRows`/`CollectOneRow`/`ForEachRow`, which close and check for you.

**Incorrect:**

```go
rows, err := db.Query(ctx, `SELECT id, name FROM customers WHERE tenant_id = $1`, tenantID)
if err != nil {
	return nil, err
}
for rows.Next() {
	// scan...
}
return customers, nil
```

**Correct:**

```go
rows, err := db.Query(ctx, `SELECT id, name FROM customers WHERE tenant_id = $1 AND deleted_at IS NULL`, tenantID)
if err != nil {
	return nil, fmt.Errorf("list customers: %w", err)
}
customers, err := pgx.CollectRows(rows, pgx.RowToStructByName[Customer])
if err != nil {
	return nil, fmt.Errorf("list customers: %w", err)
}
return customers, nil
```

With `database/sql`: `defer rows.Close()`, loop, then `if err := rows.Err(); err != nil { return nil, ... }`.

**How to check:** `scripts/scan.sh` flags `rows, err := ….Query(` with neither a deferred `Close()` nor a `pgx.Collect…`/`ForEachRow` in the next eight lines. `sqlclosecheck` and `rowserrcheck` do it precisely.
