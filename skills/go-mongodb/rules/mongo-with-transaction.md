---
title: Run multi-document transactions through WithTransaction with its context
impact: HIGH
tags: mongodb, transactions, sessions, retries
check: scan, review
---

## Run multi-document transactions through WithTransaction with its context

**Impact: HIGH** (operations given the outer `ctx` instead of the session context run outside the transaction and commit even when it aborts; a hand-rolled `StartTransaction`/`CommitTransaction` doesn't retry transient errors or an unknown commit result, so writes fail or apply twice during an election)

Use a transaction only when several documents must change together; a single-document write is already atomic, and a document shaped for its access pattern often removes the need. Start a session, `defer sess.EndSession(ctx)`, and call `sess.WithTransaction(ctx, fn)`: it retries the callback on `TransientTransactionError` and the commit on `UnknownTransactionCommitResult`. Inside `fn`, every operation uses the `ctx` the callback receives, and `fn` has no side effects outside MongoDB (no HTTP calls, no messages published), because it can run more than once. Transactions need a replica set or sharded cluster, in tests too.

**Incorrect:**

```go
_, err = sess.WithTransaction(ctx, func(sc context.Context) (any, error) {
	if _, err := s.orders().InsertOne(ctx, o); err != nil { // outer ctx: not in the transaction
		return nil, err
	}
	s.publisher.OrderPlaced(o) // runs again on every retry
	return nil, nil
})
```

**Correct:**

```go
sess, err := s.client.StartSession()
if err != nil {
	return fmt.Errorf("start session: %w", err)
}
defer sess.EndSession(ctx)

_, err = sess.WithTransaction(ctx, func(ctx context.Context) (any, error) {
	if _, err := s.orders().InsertOne(ctx, o); err != nil {
		return nil, fmt.Errorf("insert order: %w", err)
	}
	if _, err := s.outbox().InsertOne(ctx, orderPlacedEvent(o)); err != nil { // published later from the outbox
		return nil, fmt.Errorf("insert outbox event: %w", err)
	}
	return nil, nil
})
if err != nil {
	return fmt.Errorf("place order: %w", err)
}
```

Naming the callback's parameter `ctx` shadows the outer one, so the outer context can't be used by mistake.

**How to check:** `scripts/scan.sh` flags `StartTransaction(` (hand-rolled transactions) and a `WithTransaction` callback whose parameter isn't named `ctx`. In review, check that nothing in the callback talks to anything but MongoDB.
