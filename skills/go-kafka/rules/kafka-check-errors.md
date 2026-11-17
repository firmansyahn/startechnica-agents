---
title: Check every produce result and every fetch error
impact: CRITICAL
tags: kafka, producer, consumer, errors
check: scan, review
---

## Check every produce result and every fetch error

**Impact: CRITICAL** (a failed produce that nobody reads loses the event while the caller reports success; unread fetch errors hide a consumer that stopped reading a partition)

franz-go returns produce failures only through the `ProduceResults` of `ProduceSync` or the `err` of a `Produce` promise; a `nil` promise throws the error away. A poll returns records and errors together: read `fetches.Errors()` (or `EachError`) on every poll, and `IsClientClosed()` to leave the loop.

**Incorrect:**

```go
cl.Produce(ctx, rec, nil)          // failure lost
cl.ProduceSync(ctx, rec)           // result ignored

fetches := cl.PollFetches(ctx)
fetches.EachRecord(handle)         // errors never looked at
```

**Correct:**

```go
if err := cl.ProduceSync(ctx, rec).FirstErr(); err != nil {
	return fmt.Errorf("publish order %s: %w", orderID, err)
}

cl.Produce(ctx, rec, func(r *kgo.Record, err error) {
	if err != nil {
		failed.Inc()
		log.Error("publish", zap.String("topic", r.Topic), zap.Error(err)) // and retry or keep the outbox row
	}
})

fetches := cl.PollFetches(ctx)
if fetches.IsClientClosed() {
	return nil
}
for _, fe := range fetches.Errors() {
	log.Error("kafka fetch", zap.String("topic", fe.Topic), zap.Int32("partition", fe.Partition), zap.Error(fe.Err))
}
fetches.EachRecord(handle)
```

**How to check:** `scripts/scan.sh` flags `Produce(…, nil)`, a `ProduceSync(` whose result is neither assigned nor followed by `.FirstErr()`, and files that poll without reading `Errors()`, `EachError`, `Err()` or `Err0()`. In review, follow each promise to the code that acts on `err`.
