---
title: Consume work in a fixed consumer group of the service's own
impact: HIGH
tags: kafka, consumer, group, offsets
check: scan (candidates), test, review
---

## Consume work in a fixed consumer group of the service's own

**Impact: HIGH** (without a group, or with a new one per start, nothing is committed: every restart reprocesses the topic from its start, and every replica processes every record; a group shared by two services splits the records, so each misses part of them)

A consumer that processes work joins a consumer group: its committed offsets let it resume where it stopped, and the group shares the partitions among the replicas. The group ID comes from the settings, names the service and the purpose (`billing-order-events`), stays the same across restarts and deploys, and belongs to one service only; it is never generated at start from a UUID, the hostname, the pod name or the time (a pod name belongs in `kgo.InstanceID`, which identifies the member, not the group). A consumer without a group is correct only when every instance must see every record (cache invalidation, an in-memory table built from a compacted topic, a replay or debugging tool): it says so in a comment and sets where it starts with `kgo.ConsumeStartOffset`. Producers carry no group.

**Incorrect:**

```go
host, _ := os.Hostname()
cl, err := kgo.NewClient(append(opts,
	kgo.ConsumerGroup("billing-"+host), // a new group per pod and per restart: no offsets, no sharing
	kgo.ConsumeTopics("orders.v1"),
)...)

// No group at all: every replica bills every order, from the start of the topic, after every restart.
cl, err := kgo.NewClient(append(opts, kgo.ConsumeTopics("orders.v1"))...)
```

**Correct:**

```go
// kafka.group: billing-order-events, kafka.topics: [orders.v1]
// (validate refuses topics without a group, unless kafka.broadcast is true)
cl, err := kgo.NewClient(append(opts,
	kgo.ConsumerGroup(cfg.Group),
	kgo.ConsumeTopics(cfg.Topics...),
)...)

// kafka.broadcast: true. No group on purpose: every replica drops its cached prices
// on every change, starting from now.
cl, err := kgo.NewClient(append(opts,
	kgo.ConsumeTopics(cfg.Topics...),
	kgo.ConsumeStartOffset(kgo.NewOffset().AtEnd()),
)...)
```

With ACLs on, the service's principal needs Read on its group as well as on the topics (`kafka-authenticated-connection`).

**How to check:** `scripts/scan.sh` flags a `ConsumerGroup(` whose argument is built from a UUID, random value, hostname, process ID or the time, and a file that calls `ConsumeTopics(`/`ConsumePartitions(` with neither `ConsumerGroup(` nor `ConsumeStartOffset(` in it. A settings test asserts that `validate` refuses topics without a group (unless `broadcast` is set) and a group together with `broadcast`. In review, check that no other service uses the same group ID.
