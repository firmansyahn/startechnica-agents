---
title: Publish database changes through a transactional outbox
impact: CRITICAL
tags: kafka, database, outbox, consistency
check: review
---

## Publish database changes through a transactional outbox

**Impact: CRITICAL** (a crash or a broker outage between the commit and the produce loses the event for good; producing first and then failing the commit announces a change that never happened)

A database write and a Kafka produce can't share a transaction. Insert the event into an outbox table in the same database transaction as the change; a relay reads unsent rows (`FOR UPDATE SKIP LOCKED`), produces them with `ProduceSync`, and marks them sent. Consumers dedupe on the event ID, since the relay can send a row twice.

**Incorrect:**

```go
if err := tx.Commit(ctx); err != nil {
	return err
}
return publisher.Publish(ctx, OrderPlaced{OrderID: id}) // lost if this fails or the pod dies here
```

**Correct:**

```go
tx, err := pool.Begin(ctx)
if err != nil {
	return fmt.Errorf("begin: %w", err)
}
defer tx.Rollback(ctx)
if _, err := tx.Exec(ctx, `INSERT INTO orders (id, customer_id, total) VALUES ($1, $2, $3)`, id, customerID, total); err != nil {
	return fmt.Errorf("insert order: %w", err)
}
if _, err := tx.Exec(ctx,
	`INSERT INTO outbox (id, topic, key, payload) VALUES ($1, 'orders.v1', $2, $3)`,
	eventID, id, payload); err != nil {
	return fmt.Errorf("insert outbox: %w", err)
}
return tx.Commit(ctx) // the relay publishes the row
```

**How to check:** review: look for a `Produce`/`Publish` call right after a `Commit` (or before one) in the same function, and for handlers that write to the database and then publish. The relay is in [references/producer.md](../references/producer.md) ("The outbox relay").
