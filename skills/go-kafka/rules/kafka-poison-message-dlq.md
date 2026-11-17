---
title: Retry a bounded number of times, then dead-letter and move on
impact: HIGH
tags: kafka, consumer, retries, dead-letter
check: review
---

## Retry a bounded number of times, then dead-letter and move on

**Impact: HIGH** (one record that always fails blocks its partition forever and lag grows without bound; skipping it silently loses the event)

A handler error is retried a few times with backoff for transient failures (a timeout, a deadlock). A permanent failure (it doesn't decode, it fails validation) or one that outlasts the retries is produced with `ProduceSync` to the topic's dead-letter topic (`orders.v1.dlq`) with the original key and value and headers naming the source topic, partition, offset and error; only then is the record committed. Retries respect the context, so shutdown isn't held up.

**Incorrect:**

```go
for {
	if err := h.Handle(ctx, rec); err == nil {
		break
	}
	time.Sleep(time.Second) // forever, partition stalled
}
```

**Correct:**

```go
err := retry(ctx, 3, 200*time.Millisecond, func() error { return h.Handle(ctx, rec) })
if err != nil {
	if dlqErr := c.deadLetter(ctx, rec, err); dlqErr != nil {
		return fmt.Errorf("dead-letter %s/%d@%d: %w", rec.Topic, rec.Partition, rec.Offset, dlqErr) // don't commit
	}
	c.deadLettered.Inc()
}
c.cl.MarkCommitRecords(rec)
```

**How to check:** review every consumer: find where a handler error goes. It must end in success, a dead-letter produce whose error is checked, or a stop without committing; never an unbounded loop and never a commit after a failed dead-letter. The dead-letter topic has an alert on its size. Sketch: [references/consumer.md](../references/consumer.md) ("Retries and dead letters").
