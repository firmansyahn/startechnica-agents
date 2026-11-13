---
title: Keep SQL in the data-access layer
impact: LOW
tags: database, layering, sql
check: scan (candidates)
---

## Keep SQL in the data-access layer

**Impact: LOW** (SQL spread across handlers and services is hard to find when the schema changes, and skips the shared filters: tenant scope, soft delete)

SQL lives in the database package or in typed accessors next to it (a store or repository per domain); domain code calls those, handlers never hold SQL. If the project caps raw SQL per package (a test counting queries), never raise a cap; move the query instead.

**Incorrect:**

```go
// internal/api/customers/handler.go
rows, err := h.db.Query(r.Context(), `SELECT id, name FROM customers WHERE tenant_id = $1`, tenant)
```

**Correct:**

```go
// internal/database/customers.go
func (db *DB) ListCustomers(ctx context.Context, tenantID string) ([]Customer, error) { /* the query */ }

// internal/api/customers/handler.go
customers, err := h.customers.List(r.Context(), caller.TenantID)
```

**How to check:** `scripts/scan.sh` lists, per file, SQL statements in string literals outside the data-access directories (`SQL_DIRS`, default `internal/database internal/db internal/store internal/repository`). Set `SQL_DIRS` to the project's layout; a project that keeps SQL in each domain's store package on purpose documents that and this rule doesn't apply.
