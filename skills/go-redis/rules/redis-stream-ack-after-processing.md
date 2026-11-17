---
title: Acknowledge stream entries after processing, and reclaim stale pending ones
impact: HIGH
tags: redis, streams, messaging, delivery
check: scan, review
---

## Acknowledge stream entries after processing, and reclaim stale pending ones

**Impact: HIGH** (an entry acknowledged before it is processed is lost when the consumer crashes; entries never acknowledged or reclaimed sit in the pending list forever and are never processed)

Read with a consumer group (`XReadGroup` with `">"`), handle the entry, then `XAck` it; never use `NoAck: true` for work that matters. A consumer that dies leaves entries pending, so each consumer also takes over entries idle longer than the processing timeout with `XAutoClaim`, and moves an entry that keeps failing to a dead-letter stream after a few deliveries. Delivery is at least once: the handler is idempotent. Pub/Sub delivers nothing to a subscriber that is down, so it is only for signals that may be lost.

**Incorrect:**

```go
res, err := c.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
	Group: "billing", Consumer: c.name, Streams: []string{"orders:events", ">"},
	NoAck: true, // removed from the pending list before it is handled
}).Result()
// ...
for _, m := range msgs {
	c.rdb.XAck(ctx, "orders:events", "billing", m.ID) // acknowledged first
	c.handle(ctx, m)
}
```

**Correct:**

```go
claimed, _, err := c.rdb.XAutoClaim(ctx, &redis.XAutoClaimArgs{
	Stream: stream, Group: group, Consumer: c.name,
	MinIdle: time.Minute, Start: "0-0", Count: 50,
}).Result()
// ... then XReadGroup with ">" and Block, appended to claimed
for _, m := range msgs {
	if err := c.handle(ctx, m); err != nil {
		c.log.Warn("handle failed; left pending for retry", zap.String("id", m.ID), zap.Error(err))
		continue
	}
	if err := c.rdb.XAck(ctx, stream, group, m.ID).Err(); err != nil {
		c.log.Warn("xack failed", zap.String("id", m.ID), zap.Error(err))
	}
}
```

**How to check:** `scripts/scan.sh` flags `NoAck: true`, and files that call `XReadGroup` with no `XAutoClaim`/`XClaim` (nothing reclaims a dead consumer's entries). In review: the ack comes after the handler succeeds, the handler is idempotent, `XAdd` trims the stream (`MaxLen` or `MinID` with `Approx`), and a poison entry ends in a dead-letter stream.
