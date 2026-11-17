# Producing with franz-go

Part of [go-kafka](../SKILL.md); its rules win where this file is less strict.

## Settings and their Java names

franz-go's defaults are the safe ones; most services set only the seeds, the client ID, TLS and SASL. Change a default only with a measured reason, written next to the option.

| franz-go option | Default | Java client name | Team guidance |
|---|---|---|---|
| `RequiredAcks(AllISRAcks())` | all ISR | `acks=all` | Keep (`kafka-durable-writes`) |
| idempotent writes (`DisableIdempotentWrite()` turns off) | on | `enable.idempotence=true` | Keep on |
| `ProducerLinger(d)` | 10ms | `linger.ms` | Raise (20–100ms) for a high-volume relay; keep for request paths |
| `ProducerBatchCompression(...)` | snappy, then none | `compression.type` | `kgo.ZstdCompression()` for large JSON, else keep |
| `ProducerBatchMaxBytes(n)` | ~1MB | `batch.size` / `max.request.size` | Keep below the topic's `max.message.bytes` |
| `MaxBufferedRecords(n)` | 50,000 | `buffer.memory` (bytes) | `Produce` blocks when full; size it to memory |
| `RecordDeliveryTimeout(d)` | unlimited | `delivery.timeout.ms` | Set (for example 2m) so a broker outage surfaces as an error, not a hang |
| `RecordRetries(n)` | unlimited | `retries` | Prefer `RecordDeliveryTimeout` |
| `ProduceRequestTimeout(d)` | 10s | `request.timeout.ms` | Keep |
| `RecordPartitioner(...)` | sticky key (murmur2) | `partitioner.class` | Keep: the same key goes to the same partition as with the Java client |
| `TransactionalID(id)` | none | `transactional.id` | Only for exactly-once (below) |

With idempotence on, a failed record fails every record buffered behind it on that partition, so order has no gaps: a record is never written after an earlier one failed.

## Sync or async

```go
// Request path: answer only after the event is durable.
if err := cl.ProduceSync(ctx, rec).FirstErr(); err != nil {
	return fmt.Errorf("publish: %w", err)
}

// Several records at once, still synchronous: one round trip per partition.
results := cl.ProduceSync(ctx, recs...)
for _, r := range results {
	if r.Err != nil {
		return fmt.Errorf("publish %s: %w", r.Record.Topic, r.Err)
	}
}
```

For throughput, `Produce` with a promise, and a way to learn about failures: a counter and a log line at least, and, for anything that must not be lost, a retry path such as leaving the outbox row unsent.

```go
var wg sync.WaitGroup
for _, rec := range recs {
	wg.Add(1)
	cl.Produce(ctx, rec, func(r *kgo.Record, err error) {
		defer wg.Done()
		if err != nil {
			failed.Add(1)
			log.Error("publish", zap.String("topic", r.Topic), zap.Error(err))
		}
	})
}
wg.Wait() // or cl.Flush(ctx) when the client is not shared
```

Promises run one at a time on the client's goroutine: do no I/O in them, and never call `Flush`, `ProduceSync` or a blocking `Produce` from inside one (it can deadlock the client). `kgo.AbortingFirstErrPromise` exists for transactional batches.

**Contexts.** A buffered record is canceled when the context given to `Produce` is canceled. A request handler that starts an async produce and returns would cancel it: either wait (`ProduceSync`), or detach with `context.WithoutCancel(ctx)`, which keeps the trace values.

## Records

- **Key:** the entity ID (`kafka-key-for-ordering`).
- **Value:** the versioned envelope (team decision 3). Keep records small (well under 1MB); a large payload goes to object storage and the record carries its reference.
- **Headers:** `event-type`, `schema-version`, and the trace context (`kotel` injects `traceparent` itself). No secrets or personal data in headers: they are copied to dead-letter topics and logs.
- **Timestamp:** left empty, franz-go sets the produce time. Set it to the event's time only when consumers window by event time.

## The outbox relay

`kafka-outbox-for-db-writes` writes the event to an `outbox` table in the business transaction. One relay loop (or one per partition of the outbox) publishes it:

```go
// relayOnce publishes up to 100 unsent outbox rows. Rows are locked so
// several replicas can run the relay without sending a row twice at once.
func (r *Relay) relayOnce(ctx context.Context) (int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `
		SELECT id, topic, key, payload FROM outbox
		WHERE sent_at IS NULL
		ORDER BY created_at
		LIMIT 100
		FOR UPDATE SKIP LOCKED`)
	if err != nil {
		return 0, fmt.Errorf("read outbox: %w", err)
	}
	pending, err := pgx.CollectRows(rows, pgx.RowToStructByName[outboxRow])
	if err != nil {
		return 0, fmt.Errorf("read outbox: %w", err)
	}
	if len(pending) == 0 {
		return 0, nil
	}

	recs := make([]*kgo.Record, 0, len(pending))
	for _, row := range pending {
		recs = append(recs, &kgo.Record{
			Topic:   row.Topic,
			Key:     []byte(row.Key),
			Value:   row.Payload,
			Headers: []kgo.RecordHeader{{Key: "event-id", Value: []byte(row.ID.String())}},
		})
	}
	if err := r.cl.ProduceSync(ctx, recs...).FirstErr(); err != nil {
		return 0, fmt.Errorf("publish outbox: %w", err) // rows stay unsent; retried next round
	}

	ids := make([]uuid.UUID, len(pending))
	for i, row := range pending {
		ids[i] = row.ID
	}
	if _, err := tx.Exec(ctx, `UPDATE outbox SET sent_at = now() WHERE id = ANY($1)`, ids); err != nil {
		return 0, fmt.Errorf("mark outbox sent: %w", err)
	}
	return len(pending), tx.Commit(ctx)
}
```

- A crash after the produce and before the commit sends the rows again: consumers dedupe on `event-id` (`kafka-idempotent-handler`).
- `ORDER BY created_at` with a single relay keeps per-key order. With several relays, order per key holds only if each key is relayed by one of them (partition the outbox by key hash).
- Delete or archive sent rows on a schedule; index `(created_at) WHERE sent_at IS NULL`.
- Change-data capture (Debezium reading the write-ahead log) is the alternative when the platform runs it; the table shape is the same.

## Transactions (exactly-once)

Exactly-once covers records produced and offsets committed to Kafka together. Use it for consume-transform-produce between topics (an enrichment or routing service), through `kgo.NewGroupTransactSession`; consumers of its output read with `kgo.FetchIsolationLevel(kgo.ReadCommitted())`.

```go
sess, err := kgo.NewGroupTransactSession(
	kgo.SeedBrokers(cfg.Brokers...),
	kgo.TransactionalID(cfg.ClientID+"-enricher"), // stable per instance
	kgo.FetchIsolationLevel(kgo.ReadCommitted()),
	kgo.ConsumerGroup("order-enricher"),
	kgo.ConsumeTopics("orders.v1"),
)
if err != nil {
	return fmt.Errorf("transact session: %w", err)
}
defer sess.Close()

for {
	fetches := sess.PollFetches(ctx)
	if fetches.IsClientClosed() || ctx.Err() != nil {
		return nil
	}
	// check fetches.Errors() as usual
	if err := sess.Begin(); err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	var produceErr error
	fetches.EachRecord(func(r *kgo.Record) {
		out, err := enrich(r)
		if err == nil {
			err = sess.ProduceSync(ctx, out).FirstErr()
		}
		if err != nil && produceErr == nil {
			produceErr = err
		}
	})
	committed, err := sess.End(ctx, produceErr == nil) // commits records and offsets, or aborts
	if err != nil {
		return fmt.Errorf("end transaction: %w", err)
	}
	if !committed {
		log.Warn("transaction aborted; records will be consumed again", zap.Error(produceErr))
	}
}
```

It does not make a database write or an HTTP call exactly-once: those still need the outbox and idempotent handlers. Don't cancel the context passed to `End` except to shut down.
