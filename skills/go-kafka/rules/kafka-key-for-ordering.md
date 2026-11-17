---
title: Key records by the entity whose order matters
impact: HIGH
tags: kafka, producer, ordering, partitioning
check: review
---

## Key records by the entity whose order matters

**Impact: HIGH** (unkeyed or randomly keyed events for one entity land on different partitions and are consumed out of order: an `OrderCancelled` applied before its `OrderPlaced`)

Kafka orders records only within a partition, and the partitioner picks the partition from the key. Every record about an entity carries that entity's ID as its key (the order ID for order events), so all its events go to one partition in the order they were produced. Don't key by something that changes per event (a timestamp, a request ID), and don't change a topic's partition count once keyed data flows; that moves keys.

**Incorrect:**

```go
rec := &kgo.Record{Topic: "orders.v1", Value: payload}                              // no key
rec := &kgo.Record{Topic: "orders.v1", Key: []byte(uuid.NewString()), Value: payload} // new key per event
```

**Correct:**

```go
rec := &kgo.Record{Topic: "orders.v1", Key: []byte(order.ID), Value: payload}
```

**How to check:** review every `kgo.Record` literal and `KeySliceRecord`/`KeyStringRecord` call: the key is the entity ID the consumers rely on for order, or the topic is documented as order-free.
