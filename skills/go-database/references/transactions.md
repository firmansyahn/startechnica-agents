# Transactions, Isolation Levels, and Locking

## Basic transaction pattern

```go
tx, err := pool.Begin(ctx) // default isolation (READ COMMITTED)
if err != nil {
    return fmt.Errorf("beginning transaction: %w", err)
}
defer tx.Rollback(ctx) // right after Begin; no-op (pgx.ErrTxClosed, ignored) if already committed

// ... execute queries using tx ...

if err := tx.Commit(ctx); err != nil {
    return fmt.Errorf("committing transaction: %w", err)
}
```

`pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error { ... })` does the same: it commits when the function returns nil and rolls back otherwise.

## Custom isolation level

```go
tx, err := pool.BeginTx(ctx, pgx.TxOptions{
    IsoLevel: pgx.Serializable, // strongest guarantee
})
```

| Level | Use when |
| --- | --- |
| `pgx.ReadCommitted` | Default — good for most operations |
| `pgx.RepeatableRead` | Need consistent reads within a transaction |
| `pgx.Serializable` | Financial operations, inventory, anything with strict consistency (retry the whole transaction on `40001`) |

## SELECT FOR UPDATE — prevent race conditions

```go
var balance int64
err := tx.QueryRow(ctx,
    "SELECT balance FROM accounts WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", accountID,
).Scan(&balance)
// Row is locked until tx.Commit(ctx) or tx.Rollback(ctx)
```

Use `FOR UPDATE` when you read a value, compute something from it, and then write it back. Without the lock, concurrent transactions can read stale data.

## Locking variants

| Clause | Effect |
| --- | --- |
| `FOR UPDATE` | Locks rows for write — other transactions block on same rows |
| `FOR UPDATE NOWAIT` | Same, but fails immediately instead of waiting |
| `FOR SHARE` | Locks rows for read — prevents writes but allows other reads |
