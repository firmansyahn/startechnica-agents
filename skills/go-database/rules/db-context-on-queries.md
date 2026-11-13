---
title: Run every query with the request's context
impact: MEDIUM
tags: database, context, cancellation
check: scan
---

## Run every query with the request's context

**Impact: MEDIUM** (a cancelled request or a shutdown leaves its queries running; a slow query can't be bounded by a deadline)

With `database/sql`, use the `…Context` methods (`QueryContext`, `ExecContext`, `QueryRowContext`, `BeginTx`) and pass the caller's `ctx`; the plain `Query`/`Exec` use `context.Background()`. pgx always takes a context: pass the caller's, not a fresh one (`conc-context-propagation`). Long reports and sweeps add their own `context.WithTimeout`.

**Incorrect:**

```go
row := db.QueryRow("SELECT name FROM customers WHERE id = $1", id)
```

**Correct:**

```go
row := db.QueryRowContext(ctx, "SELECT name FROM customers WHERE id = $1 AND deleted_at IS NULL", id)
```

**How to check:** `scripts/scan.sh` flags `.Query(`, `.QueryRow(`, `.Exec(` and `.Prepare(` whose first argument is a string literal (so no context came first).
