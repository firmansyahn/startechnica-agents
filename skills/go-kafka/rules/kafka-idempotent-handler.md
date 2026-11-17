---
title: Make every handler safe to run twice for one record
impact: HIGH
tags: kafka, consumer, idempotency, delivery
check: review, test
---

## Make every handler safe to run twice for one record

**Impact: HIGH** (at-least-once delivery replays records after a crash, a rebalance or an outbox retry; a handler that isn't idempotent charges twice, sends two emails, or double-counts)

Every record carries a stable event ID (in the envelope or a header). A handler either writes with an upsert keyed by that ID, or records the ID in a processed-events table in the same transaction as its effect and skips IDs it has seen. Side effects outside the database (an HTTP call) pass the event ID as their idempotency key.

**Incorrect:**

```go
func (h *Handler) OrderPlaced(ctx context.Context, ev OrderPlaced) error {
	_, err := h.db.Exec(ctx, `UPDATE customers SET order_count = order_count + 1 WHERE id = $1`, ev.CustomerID)
	return err
}
```

**Correct:**

```go
func (h *Handler) OrderPlaced(ctx context.Context, ev OrderPlaced) error {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING`, ev.ID)
	if err != nil {
		return fmt.Errorf("record event %s: %w", ev.ID, err)
	}
	if tag.RowsAffected() == 0 {
		return nil // seen before
	}
	if _, err := tx.Exec(ctx, `UPDATE customers SET order_count = order_count + 1 WHERE id = $1`, ev.CustomerID); err != nil {
		return fmt.Errorf("count order for customer %s: %w", ev.CustomerID, err)
	}
	return tx.Commit(ctx)
}
```

**How to check:** a test calls the handler twice with the same event and asserts the effect happened once. In review, look for increments, inserts without a conflict target, and outbound calls without an idempotency key.
