---
title: Stop polling, finish, commit, flush, then close
impact: HIGH
tags: kafka, lifecycle, shutdown
check: scan (candidates), review
---

## Stop polling, finish, commit, flush, then close

**Impact: HIGH** (a producer closed without `Flush` fails every buffered record; a consumer killed mid-batch without committing replays it and holds its partitions until the session times out, stalling the group)

On shutdown, cancel the context the consumer polls with, wait for the loop and its workers to finish the current record, commit (autocommit does it in `Close`; manual commit calls `CommitUncommittedOffsets` or `CommitMarkedOffsets`), then `Close` to leave the group. Producers `Flush` with a deadline, then `Close`. A client is created once and closed by its owner, never per request.

**Incorrect:**

```go
func (p *Publisher) Publish(ctx context.Context, rec *kgo.Record) error {
	cl, err := kgo.NewClient(kgo.SeedBrokers(p.brokers...)) // a client per call
	if err != nil {
		return err
	}
	defer cl.Close() // buffered records failed
	cl.Produce(ctx, rec, nil)
	return nil
}
```

**Correct:**

```go
// main, after the signal:
cancel()          // the poll loop returns
wg.Wait()         // workers done, offsets marked
if err := consumer.CommitMarkedOffsets(context.Background()); err != nil {
	log.Error("final commit", zap.Error(err))
}
consumer.Close()

flushCtx, stop := context.WithTimeout(context.Background(), 10*time.Second)
defer stop()
if err := producer.Flush(flushCtx); err != nil {
	log.Error("flush on shutdown", zap.Error(err))
}
producer.Close()
```

**How to check:** `scripts/scan.sh` flags `kgo.NewClient(` in a function that also closes the client (a client per call) and files that create a client and `Produce` with no `Flush` in the module (candidates). In review, follow `main`'s shutdown order.
