---
title: Commit an offset only after its record is processed
impact: CRITICAL
tags: kafka, consumer, offsets, delivery
check: scan (candidates), review
---

## Commit an offset only after its record is processed

**Impact: CRITICAL** (an offset committed before the work finished loses the record when the pod restarts or the partition moves)

franz-go's default autocommit is at-least-once only when records are processed inside the poll loop: it commits what earlier polls returned. Once records are handed to other goroutines, the next poll makes them committable while they are still being worked on. Then use `AutoCommitMarks()` and `MarkCommitRecords` after the work, or `DisableAutoCommit()` with `CommitRecords` from the worker and a blocking commit in `OnPartitionsRevoked`. Never `GreedyAutoCommit()`.

**Incorrect:**

```go
cl, _ := kgo.NewClient(kgo.ConsumerGroup("billing"), kgo.ConsumeTopics("orders.v1")) // autocommit
for {
	fetches := cl.PollFetches(ctx)
	fetches.EachPartition(func(p kgo.FetchTopicPartition) {
		workers[p.Partition] <- p.Records // next poll lets autocommit commit these, unprocessed
	})
}
```

**Correct:**

```go
cl, err := kgo.NewClient(
	kgo.ConsumerGroup("billing"),
	kgo.ConsumeTopics("orders.v1"),
	kgo.AutoCommitMarks(),            // commit only what workers marked
	kgo.BlockRebalanceOnPoll(),
	kgo.OnPartitionsRevoked(c.revoked), // stop workers, then CommitMarkedOffsets
)

// in the partition's worker, after the record is handled:
cl.MarkCommitRecords(rec)
```

**How to check:** `scripts/scan.sh` flags `GreedyAutoCommit` and files that poll and start goroutines but set neither `DisableAutoCommit` nor `AutoCommitMarks` (candidates). In review, trace each record from the poll to the commit, and check `OnPartitionsRevoked` commits when autocommit is off.
