---
title: Keep all-ISR acks and idempotence; declare topics explicitly
impact: HIGH
tags: kafka, producer, durability, topics
check: scan
---

## Keep all-ISR acks and idempotence; declare topics explicitly

**Impact: HIGH** (with `acks=1` a leader failover drops records the producer was told were written; without idempotence a retry duplicates or reorders them; an auto-created topic gets the broker's default partitions and replication, often one replica)

franz-go defaults to `RequiredAcks(AllISRAcks())` with idempotent writes; keep them. Topics are created by infrastructure code or an admin step with explicit partitions, a replication factor of 3 and `min.insync.replicas=2` in production, never by `AllowAutoTopicCreation()` in service code (a test against `kfake` may use it).

**Incorrect:**

```go
cl, err := kgo.NewClient(
	kgo.SeedBrokers(cfg.Brokers...),
	kgo.RequiredAcks(kgo.LeaderAck()),
	kgo.DisableIdempotentWrite(),
	kgo.AllowAutoTopicCreation(),
)
```

**Correct:**

```go
cl, err := kgo.NewClient(
	kgo.SeedBrokers(cfg.Brokers...),
	kgo.ClientID(cfg.ClientID),
	// acks=all and idempotence are the defaults; topics come from the platform's topic definitions
)
```

**How to check:** `scripts/scan.sh` flags `LeaderAck()`, `NoAck()`, `DisableIdempotentWrite()` and `AllowAutoTopicCreation()` outside `_test.go` files. A metrics or log pipeline that accepts loss may weaken acks with a comment saying so.
