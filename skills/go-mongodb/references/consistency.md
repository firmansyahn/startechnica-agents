# Write concern, read concern, read preference, transactions and change streams

Read with [SKILL.md](../SKILL.md) when a write must survive a failover, a read may go to a secondary, several documents must change together, or the service reacts to changes.

## Concerns and preferences

| Setting | Team default | When to change |
|---|---|---|
| Write concern | `writeconcern.Majority()` on the Client | `W1()` only for data the service can lose on a failover (metrics, caches), set on that collection with `options.Collection().SetWriteConcern`. Never `Unacknowledged()`. |
| Read concern | The server default (`local`) | `readconcern.Majority()` when a read must not see writes a failover could roll back; transactions that read what they write use `Snapshot()` or `Majority()`. |
| Read preference | `readpref.Primary()` | `SecondaryPreferred()` or `Nearest()` only for reads that tolerate stale data (reports, exports), on that collection or call, with `readpref.WithMaxStaleness`. Never for a read that follows a write in the same request. |

- Read-your-own-writes across secondaries needs a causally consistent session (`options.Session().SetCausalConsistency(true)`, the default for explicit sessions) with majority read and write concerns. Usually simpler: read from the primary.
- Settings on the Client apply to every Database and Collection made from it; override on `client.Database(name, options.Database()...)` or `db.Collection(name, options.Collection()...)` for one collection, not per call.

## Transactions

Use one only when several documents must change together and the model can't put them in one document. Shape (`mongo-with-transaction`):

```go
sess, err := s.client.StartSession()
if err != nil {
	return fmt.Errorf("start session: %w", err)
}
defer sess.EndSession(ctx)

txnOpts := options.Transaction().
	SetReadConcern(readconcern.Snapshot()).
	SetWriteConcern(writeconcern.Majority())

_, err = sess.WithTransaction(ctx, func(ctx context.Context) (any, error) {
	if _, err := s.orders().InsertOne(ctx, o); err != nil {
		return nil, fmt.Errorf("insert order: %w", err)
	}
	res, err := s.items().UpdateOne(ctx,
		bson.D{{Key: "sku", Value: o.SKU}, {Key: "stock", Value: bson.D{{Key: "$gte", Value: o.Quantity}}}},
		bson.D{{Key: "$inc", Value: bson.D{{Key: "stock", Value: -o.Quantity}}}},
	)
	if err != nil {
		return nil, fmt.Errorf("reserve stock: %w", err)
	}
	if res.MatchedCount == 0 {
		return nil, order.ErrOutOfStock // a non-transient error aborts without retrying
	}
	return nil, nil
}, txnOpts)
```

- `WithTransaction` retries the whole callback on a `TransientTransactionError` label and the commit on `UnknownTransactionCommitResult`, until the context deadline or the driver's 120-second limit. Give `ctx` a deadline.
- Every operation inside uses the callback's `ctx`. No side effects outside MongoDB in the callback; publish events through an outbox collection written in the same transaction, and a separate publisher (or a change stream on the outbox).
- Keep transactions short and small: the server aborts transactions running longer than `transactionLifetimeLimitSeconds` (60s by default), and a transaction holds its writes' locks until it commits, so concurrent writers to the same documents get write conflicts (retried as transient).
- Collections and indexes must exist before the transaction (create them in `EnsureIndexes`/migrations); creating one inside a transaction is limited.
- Transactions need a replica set or sharded cluster: a standalone `mongod` refuses them. Tests run a single-node replica set (references/testing.md).
- `client.UseSession(ctx, fn)` is an alternative that starts and ends the session around `fn`; inside, call `mongo.SessionFromContext(ctx).WithTransaction(...)`.

## Change streams

A change stream (`coll.Watch`, `db.Watch`, `client.Watch`) delivers inserts, updates, replaces and deletes in order. Use it to react to changes (an outbox publisher, cache invalidation, search indexing), not as a queue between services.

```go
func (s *Store) WatchOutbox(ctx context.Context, tokens TokenStore, handle func(context.Context, OutboxEvent) error) error {
	opts := options.ChangeStream().SetFullDocument(options.UpdateLookup)
	token, err := tokens.Load(ctx)
	if err != nil {
		return fmt.Errorf("load resume token: %w", err)
	}
	if token != nil {
		opts.SetResumeAfter(token)
	}
	pipeline := mongo.Pipeline{{{Key: "$match", Value: bson.D{{Key: "operationType", Value: "insert"}}}}}

	cs, err := s.outbox().Watch(ctx, pipeline, opts)
	if err != nil {
		return fmt.Errorf("watch outbox: %w", err)
	}
	defer cs.Close(ctx)

	for cs.Next(ctx) {
		var change struct {
			FullDocument OutboxEvent `bson:"fullDocument"`
		}
		if err := cs.Decode(&change); err != nil {
			return fmt.Errorf("decode change: %w", err)
		}
		if err := handle(ctx, change.FullDocument); err != nil {
			return err
		}
		if err := tokens.Save(ctx, cs.ResumeToken()); err != nil { // after the handler succeeded
			return fmt.Errorf("save resume token: %w", err)
		}
	}
	return cs.Err()
}
```

- **Resume tokens:** save `cs.ResumeToken()` after each handled event (or batch), durably, and resume with `SetResumeAfter` (or `SetStartAfter` after an invalidate). The driver resumes by itself after a transient error; the saved token covers a process restart.
- **Delivery is at least once** from the handler's point of view (a crash between handling and saving the token replays the event): handlers are idempotent.
- **Oplog window:** a token older than the oplog's retention can't resume (`ChangeStreamHistoryLost`); alert on it and fall back to a full resync.
- **One consumer per stream** unless the work is partitioned; run it as a goroutine owned by `run()` with the shutdown context (`go-concurrency`).
- **Filter in the pipeline** (`$match` on `operationType`, `ns`, fields) so the server sends only what the service needs.
- Change streams also need a replica set or sharded cluster.
