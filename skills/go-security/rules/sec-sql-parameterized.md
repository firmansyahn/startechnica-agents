---
title: Pass values as placeholders; never build SQL from input
impact: CRITICAL
tags: security, sql, injection
check: scan, lint (gosec G201/G202)
---

## Pass values as placeholders; never build SQL from input

**Impact: CRITICAL** (SQL injection: data read, changed or deleted by anyone who can reach the endpoint)

Every value goes to the driver as a placeholder (`$1`, `?`). Identifiers that must vary (a sort column, a direction) come from a fixed allow-list in code, never from the request. Building placeholders dynamically (`$` + a counter for an `IN` list) is fine; the values still travel separately.

**Incorrect:**

```go
q := fmt.Sprintf("SELECT id, name FROM customers WHERE tenant_id = '%s' ORDER BY %s", tenantID, r.URL.Query().Get("sort"))
rows, err := db.Query(ctx, q)
```

**Correct:**

```go
var sortColumns = map[string]string{"name": "name", "created": "created_at"} // read-only

col, ok := sortColumns[r.URL.Query().Get("sort")]
if !ok {
	col = "name"
}
q := `SELECT id, name FROM customers WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY ` + col
rows, err := db.Query(ctx, q, tenantID)
```

**How to check:** `scripts/scan.sh` flags `fmt.Sprintf` with SQL keywords and string concatenation onto SQL literals; confirm each concatenated part is a constant or comes from an allow-list. `gosec` G201/G202 cover the same shapes.
