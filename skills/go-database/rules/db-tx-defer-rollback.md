---
title: Defer Rollback right after Begin
impact: HIGH
tags: database, transactions
check: scan
---

## Defer Rollback right after Begin

**Impact: HIGH** (an early return or panic leaves the transaction open, holding its connection and locks until the pool or the database gives up)

`defer tx.Rollback(ctx)` on the line after a successful `Begin`; after `Commit` it is a no-op. Multi-statement writes always run in one transaction; a helper (`db.InTx(ctx, func(tx) error)`) that begins, rolls back on error and commits is better still.

**Incorrect:**

```go
tx, err := db.Begin(ctx)
if err != nil {
	return err
}
if _, err := tx.Exec(ctx, `UPDATE accounts SET balance = balance - $1 WHERE id = $2`, amt, from); err != nil {
	return err // transaction left open
}
```

**Correct:**

```go
tx, err := db.Begin(ctx)
if err != nil {
	return fmt.Errorf("begin transfer: %w", err)
}
defer tx.Rollback(ctx)

if _, err := tx.Exec(ctx, `UPDATE accounts SET balance = balance - $1 WHERE id = $2`, amt, from); err != nil {
	return fmt.Errorf("debit %s: %w", from, err)
}
// ...
if err := tx.Commit(ctx); err != nil {
	return fmt.Errorf("commit transfer: %w", err)
}
```

**How to check:** `scripts/scan.sh` flags `tx, err := ….Begin…(` with no deferred `Rollback` in the next six lines.
