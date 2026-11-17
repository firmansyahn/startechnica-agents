# Streams and Pub/Sub

The team skill wins; this is the detail behind its section 5.

## Which one

| Need | Use |
|---|---|
| A signal that may be lost (invalidate a local cache, wake a poller) | Pub/Sub |
| Work that must be done once each message, surviving restarts, with retries | A stream with a consumer group |
| An event log other teams consume, replay over days, ordering per key at high volume | Kafka (`go-kafka`), not Redis |
| A job queue with scheduling, priorities, retries and a UI | A job library on top of Redis or the database; not hand-rolled lists |

Pub/Sub delivers each message to the subscribers connected at that moment and keeps nothing: a subscriber that is restarting misses it. Streams keep entries until trimmed, track what each consumer group has read and what is still pending.

## Producing to a stream

```go
func PublishOrderPlaced(ctx context.Context, rdb redis.UniversalClient, stream, orderID string, total int64) (string, error) {
	return rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		MaxLen: 100_000, // keep about the last 100k entries
		Approx: true,    // "~": trims whole nodes, much cheaper than an exact cap
		Values: map[string]any{"order_id": orderID, "total": strconv.FormatInt(total, 10)},
	}).Result()
}
```

- **Always trim** on `XADD` (`MaxLen` or `MinID` with `Approx`), or with a periodic `XTRIM`; an untrimmed stream is a big key. Size the cap so a consumer that is down for the longest outage you accept still finds its entries.
- **Values are flat string fields.** Put a small envelope (`type`, `version`, IDs) in fields, or one `payload` field with JSON; keep entries small.
- **Write to the database and the stream together** with an outbox when losing the event would be wrong: the database commit is the truth, a relay publishes it.

## Consuming with a group

```go
// Handler processes one entry; it must be idempotent: an entry can be delivered more than once.
type Handler func(ctx context.Context, id string, values map[string]any) error

func Consume(ctx context.Context, rdb redis.UniversalClient, log *zap.Logger, stream, group, consumer string, handle Handler) error {
	err := rdb.XGroupCreateMkStream(ctx, stream, group, "$").Err()
	if err != nil && !redis.HasErrorPrefix(err, "BUSYGROUP") { // BUSYGROUP: it exists already
		return fmt.Errorf("create group %s/%s: %w", stream, group, err)
	}
	for ctx.Err() == nil {
		// Take over entries another consumer left pending for over a minute.
		msgs, _, err := rdb.XAutoClaim(ctx, &redis.XAutoClaimArgs{
			Stream: stream, Group: group, Consumer: consumer,
			MinIdle: time.Minute, Start: "0-0", Count: 50,
		}).Result()
		if err != nil {
			log.Warn("xautoclaim failed", zap.String("stream", stream), zap.Error(err))
		}

		res, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group: group, Consumer: consumer,
			Streams: []string{stream, ">"}, // ">": entries never delivered to this group
			Count:   50, Block: 5 * time.Second,
		}).Result()
		switch {
		case errors.Is(err, redis.Nil): // nothing new within Block
		case err != nil:
			if ctx.Err() != nil {
				return nil
			}
			log.Warn("xreadgroup failed", zap.String("stream", stream), zap.Error(err))
			time.Sleep(time.Second) // back off; a real worker uses a jittered backoff
			continue
		default:
			for _, s := range res {
				msgs = append(msgs, s.Messages...)
			}
		}

		for _, m := range msgs {
			if err := handle(ctx, m.ID, m.Values); err != nil {
				log.Warn("handle failed; left pending for retry", zap.String("id", m.ID), zap.Error(err))
				continue
			}
			if err := rdb.XAck(ctx, stream, group, m.ID).Err(); err != nil {
				log.Warn("xack failed", zap.String("id", m.ID), zap.Error(err))
			}
		}
	}
	return nil
}
```

- **Consumer names are stable per instance** (the pod name), so a restarted instance first gets its own pending entries back; `XAutoClaim` covers instances that never come back. Remove dead consumers with `XGROUP DELCONSUMER` once their pending list is empty.
- **Group start ID:** `"$"` reads only entries added after the group exists; `"0"` replays the whole stream. Choose deliberately when adding a group to an existing stream.
- **Poison entries:** `XPendingExt` returns `RetryCount` per entry. After a few deliveries, `XAdd` the entry to `<stream>:dead` with the error and `XAck` it, and alert on the dead stream's length.
- **Shutdown:** cancel the consumer's context and wait for its goroutine ([go-concurrency](../../go-concurrency/SKILL.md)); an entry being handled when the process stops stays pending and is reclaimed.
- **Blocking reads:** `Block` holds a pooled connection for its duration; many consumers in one process need a pool large enough for them plus the request traffic, or a separate client for the workers.
- **Lag:** `XInfoGroups` gives each group's `Lag` and `Pending`; export them as gauges and alert on growth.

## Pub/Sub

```go
func Subscribe(ctx context.Context, rdb redis.UniversalClient, channel string, fn func(payload string)) error {
	ps := rdb.Subscribe(ctx, channel)
	defer ps.Close()
	if _, err := ps.Receive(ctx); err != nil { // wait for the subscription to be confirmed
		return fmt.Errorf("subscribe %s: %w", channel, err)
	}
	ch := ps.Channel() // reconnects and resubscribes on its own
	for {
		select {
		case <-ctx.Done():
			return nil
		case m, ok := <-ch:
			if !ok {
				return nil
			}
			fn(m.Payload)
		}
	}
}
```

- A `PubSub` holds its own connection, outside the pool; open one per subscriber goroutine, close it when done.
- `Channel()` buffers 100 messages (`WithChannelSize`); when the handler can't keep up, it waits up to a minute (`WithChannelSendTimeout`) and then drops the message with a log line. Keep handlers fast; hand slow work to a stream.
- On a cluster, classic Pub/Sub broadcasts every message to every node; use sharded Pub/Sub (`SSubscribe`, `SPublish`) for high volume.
