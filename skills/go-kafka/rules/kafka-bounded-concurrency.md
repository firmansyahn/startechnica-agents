---
title: Process with one worker per partition, never a goroutine per record
impact: HIGH
tags: kafka, consumer, concurrency, ordering
check: scan (candidates), review
---

## Process with one worker per partition, never a goroutine per record

**Impact: HIGH** (a goroutine per record breaks per-key order, grows without bound under lag until memory runs out, and makes "processed" impossible to know when committing)

Ordering holds within a partition, so parallelism comes from partitions: one worker goroutine per assigned partition, started in `OnPartitionsAssigned` and stopped (and waited for) in `OnPartitionsRevoked`/`OnPartitionsLost`, each processing its records in order. For more parallelism than partitions, a fixed pool keyed by record key (`hash(key) % n`) keeps per-key order. Each worker has an owner and an exit ([go-concurrency](../../go-concurrency/SKILL.md), `conc-goroutine-owner`).

**Incorrect:**

```go
fetches.EachRecord(func(r *kgo.Record) {
	go h.Handle(ctx, r)
})
```

**Correct:**

```go
fetches.EachPartition(func(p kgo.FetchTopicPartition) {
	c.workers[tp{p.Topic, p.Partition}].recs <- p.Records // the partition's worker handles them in order
})
c.cl.AllowRebalance() // with BlockRebalanceOnPoll
```

**How to check:** `scripts/scan.sh` flags a `go` statement within a few lines after `EachRecord(` or a `range` over `Records` (candidates). In review, check that every worker is stopped and waited for on revoke and shutdown.
