# Consuming with franz-go

Part of [go-kafka](../SKILL.md); its rules win where this file is less strict.

## Group settings

| franz-go option | Default | Java client name | Team guidance |
|---|---|---|---|
| `ConsumerGroup(g)`, `ConsumeTopics(t...)` | none | `group.id`, `subscribe` | One fixed group per service and purpose (`billing-order-events`), from the settings (`kafka-stable-consumer-group`) |
| `Balancers(...)` | cooperative-sticky | `partition.assignment.strategy` | Keep. Moving a live group between eager and cooperative needs a rollout plan (KIP-429) |
| `ConsumeStartOffset(o)` | `NewOffset().AtStart()` | `auto.offset.reset` (for a new group) | franz-go starts a new group at the **earliest** record, Java at the latest. Decide per consumer and write it down: a new projection usually wants the history, a notifier usually doesn't (`AtEnd()`) |
| `ConsumeResetOffset(o)` | rewind one minute | `auto.offset.reset` (on lost data) | Keep |
| `AutoCommitInterval(d)` | 5s | `auto.commit.interval.ms` | Keep |
| `SessionTimeout(d)` | 45s | `session.timeout.ms` | Keep; raise with `InstanceID` |
| `InstanceID(id)` | none (dynamic) | `group.instance.id` | Static membership (a StatefulSet pod name) avoids a rebalance per rolling restart; needs a session timeout longer than a restart |
| `FetchIsolationLevel(ReadCommitted())` | read uncommitted | `isolation.level` | Set when the topic is written transactionally |
| `FetchMaxBytes`, `MaxConcurrentFetches` | 50MB, unlimited | `fetch.max.bytes` | Bound memory for big records |

## With a group, or without one

| The consumer | Group | Starts at | Why |
|---|---|---|---|
| Processes work: billing, projections, notifications, anything with side effects | `ConsumerGroup(cfg.Group)`, fixed and the service's own | its committed offset; `ConsumeStartOffset` only for the group's first start | Offsets survive restarts, replicas share the partitions, commits mean something |
| Every replica must see every record: cache invalidation, an in-memory table from a compacted topic | none (`broadcast: true`) | `ConsumeStartOffset(kgo.NewOffset().AtEnd())` for invalidation, `AtStart()` to rebuild a table | Each replica has its own state; a group would hand each record to one replica only |
| A replay, backfill or debugging tool | none, or a group named for the run when it must resume | set explicitly, often `ConsumePartitions` with exact offsets | It must not move the service's committed offsets |

- **One ID, one service.** Two services in one group split the partitions between them: each processes some records and never sees the rest. Two deployments of the same service (blue and green) share the group on purpose.
- **Never generated.** A UUID, hostname, pod name or timestamp in the group ID makes a new group per start: no committed offsets, the topic reprocessed from `ConsumeStartOffset`, and old groups left on the broker. Static membership uses the pod name as `kgo.InstanceID`, which names the member, not the group.
- **Renaming a group** starts from scratch: copy the offsets first (`kadm` `FetchOffsets` then `CommitOffsets` to the new group) or accept the replay or the gap.
- **ACLs:** the principal needs Read on the group as well as on the topics.

## Choosing a commit strategy

| Processing | Commit option | How a record gets committed |
|---|---|---|
| In the poll loop, one record after another | default autocommit | The next poll makes the previous poll's records committable; the 5s autocommit and `Close` commit them |
| In the poll loop, a whole batch, then commit | `DisableAutoCommit()` | `CommitUncommittedOffsets(ctx)` after the batch, plus `OnPartitionsRevoked` doing the same |
| Handed to a worker per partition | `AutoCommitMarks()` + `BlockRebalanceOnPoll()` | The worker calls `MarkCommitRecords(r)` after each record; autocommit commits marks; `OnPartitionsRevoked` stops the workers, then `CommitMarkedOffsets` |
| Consume-transform-produce between topics, exactly once | `NewGroupTransactSession` | `sess.End(ctx, kgo.TryCommit)` commits records and offsets atomically ([producer.md](producer.md)) |

Never `GreedyAutoCommit()`: it commits everything polled, processed or not.

Committing after a rebalance can't commit a partition you no longer own when rebalances are blocked during processing (`BlockRebalanceOnPoll`); without it, a commit can land on a moved partition and the new owner replays a little. Both are at-least-once; handlers are idempotent either way.

## A worker per partition

`BlockRebalanceOnPoll` keeps polling and the rebalance callbacks from running at the same time, so the workers map needs no mutex. Poll a bounded number of records and allow rebalances right after handing them out, so the group isn't held past its rebalance timeout.

```go
type tp struct {
	topic     string
	partition int32
}

type worker struct {
	recs chan []*kgo.Record
	quit chan struct{}
	done chan struct{}
}

type Consumer struct {
	cl       *kgo.Client
	producer *kgo.Client                              // for the dead-letter topic
	handler  func(context.Context, *kgo.Record) error // decodes and calls the Domain service
	log      *zap.Logger
	runCtx  context.Context
	workers map[tp]*worker // touched by the poll loop and the callbacks only
}

func NewConsumer(cfg Config, producer *kgo.Client, handler func(context.Context, *kgo.Record) error, log *zap.Logger) (*Consumer, error) {
	c := &Consumer{producer: producer, handler: handler, log: log, workers: make(map[tp]*worker)}
	opts, err := baseOpts(cfg, log)
	if err != nil {
		return nil, err
	}
	opts = append(opts,
		kgo.ConsumerGroup(cfg.Group),
		kgo.ConsumeTopics(cfg.Topics...),
		kgo.AutoCommitMarks(),
		kgo.BlockRebalanceOnPoll(),
		kgo.OnPartitionsAssigned(c.assigned),
		kgo.OnPartitionsRevoked(c.revoked),
		kgo.OnPartitionsLost(c.lost),
	)
	if c.cl, err = kgo.NewClient(opts...); err != nil {
		return nil, fmt.Errorf("kafka consumer: %w", err)
	}
	return c, nil
}

func (c *Consumer) Run(ctx context.Context) error {
	c.runCtx = ctx
	for {
		fetches := c.cl.PollRecords(ctx, 500)
		if fetches.IsClientClosed() || ctx.Err() != nil {
			c.cl.AllowRebalance()
			return nil
		}
		for _, fe := range fetches.Errors() {
			c.log.Error("kafka fetch", zap.String("topic", fe.Topic), zap.Int32("partition", fe.Partition), zap.Error(fe.Err))
		}
		fetches.EachPartition(func(p kgo.FetchTopicPartition) {
			w := c.workers[tp{p.Topic, p.Partition}]
			select {
			case w.recs <- p.Records:
			case <-ctx.Done():
			}
		})
		c.cl.AllowRebalance()
	}
}

func (c *Consumer) assigned(_ context.Context, _ *kgo.Client, assigned map[string][]int32) {
	for topic, partitions := range assigned {
		for _, p := range partitions {
			w := &worker{recs: make(chan []*kgo.Record, 4), quit: make(chan struct{}), done: make(chan struct{})}
			c.workers[tp{topic, p}] = w
			go c.work(w)
		}
	}
}

func (c *Consumer) work(w *worker) {
	defer close(w.done)
	for {
		select {
		case <-w.quit:
			return
		case recs := <-w.recs:
			for _, r := range recs {
				if err := c.handleWithRetry(c.runCtx, r); err != nil {
					return // shutting down: leave it unmarked, the next owner gets it
				}
				c.cl.MarkCommitRecords(r)
			}
		}
	}
}

// stop ends the workers of the given partitions and waits for them.
func (c *Consumer) stop(partitions map[string][]int32) {
	var wg sync.WaitGroup
	for topic, ps := range partitions {
		for _, p := range ps {
			key := tp{topic, p}
			w, ok := c.workers[key]
			if !ok {
				continue
			}
			delete(c.workers, key)
			close(w.quit)
			wg.Add(1)
			go func() { defer wg.Done(); <-w.done }()
		}
	}
	wg.Wait()
}

func (c *Consumer) revoked(ctx context.Context, cl *kgo.Client, revoked map[string][]int32) {
	c.stop(revoked)
	if err := cl.CommitMarkedOffsets(ctx); err != nil {
		c.log.Error("commit on revoke", zap.Error(err))
	}
}

func (c *Consumer) lost(_ context.Context, _ *kgo.Client, lost map[string][]int32) {
	c.stop(lost) // the partitions are gone; a commit would fail
}

func (c *Consumer) Close() { c.cl.Close() } // the final revoke stops the workers and commits
```

- A worker that is busy when its partition is revoked finishes its current batch before `stop` returns, so keep batches small (`PollRecords`) and handlers bounded by timeouts; callbacks that outlast the rebalance timeout get the member kicked out.
- Never call `Close` or `LeaveGroup` from inside a callback.
- More parallelism than partitions: inside a partition's worker, fan out to a fixed pool keyed by `hash(record.Key) % n`, and mark a record only when it and every earlier record of that partition are done (franz-go commits the highest marked offset). Usually it is simpler to add partitions when the topic is created.

## Retries and dead letters

```go
var ErrPermanent = errors.New("permanent") // wrap decode and validation failures with it

func (c *Consumer) handleWithRetry(ctx context.Context, r *kgo.Record) error {
	var err error
	for attempt := range 3 {
		if err = c.handler(ctx, r); err == nil || errors.Is(err, ErrPermanent) {
			break
		}
		select {
		case <-time.After(time.Duration(100<<attempt) * time.Millisecond): // 100ms, 200ms, 400ms
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	if err == nil {
		return nil
	}
	c.log.Warn("dead-lettering record", zap.String("topic", r.Topic), zap.Int32("partition", r.Partition), zap.Int64("offset", r.Offset), zap.Error(err))
	return c.deadLetter(ctx, r, err)
}

func (c *Consumer) deadLetter(ctx context.Context, r *kgo.Record, cause error) error {
	msg := cause.Error()
	if len(msg) > 512 {
		msg = msg[:512]
	}
	headers := append(slices.Clone(r.Headers),
		kgo.RecordHeader{Key: "dlq-source-topic", Value: []byte(r.Topic)},
		kgo.RecordHeader{Key: "dlq-source-partition", Value: []byte(strconv.Itoa(int(r.Partition)))},
		kgo.RecordHeader{Key: "dlq-source-offset", Value: []byte(strconv.FormatInt(r.Offset, 10))},
		kgo.RecordHeader{Key: "dlq-error", Value: []byte(msg)},
	)
	dl := &kgo.Record{Topic: r.Topic + ".dlq", Key: r.Key, Value: r.Value, Headers: headers}
	if err := c.producer.ProduceSync(ctx, dl).FirstErr(); err != nil {
		return fmt.Errorf("dead-letter %s/%d@%d: %w", r.Topic, r.Partition, r.Offset, err)
	}
	return nil
}
```

- An error from `handleWithRetry` means the record is **not** handled: the worker stops without marking it. That happens only on shutdown or when the dead-letter produce fails, which is an alert, not a skip.
- The dead-letter topic has the same key, so a replay tool can re-produce the records to the source topic once the bug is fixed. Alert on its size growing.
- Dead-lettering one record lets later records of the same key go ahead out of order. Where that is unacceptable (a ledger), stop the partition instead (`PauseFetchPartitions`, alert) and let a person decide.
- Long waits (minutes) belong in a retry topic with a delay, consumed by a separate group, not in a sleeping worker that holds the partition and the rebalance.

## Lag

Lag is the distance between a partition's end offset and the group's committed offset. Measure it from outside the consumer, so a stuck consumer still reports it: the broker's exporter, or a small job with `kadm`:

```go
adm := kadm.NewClient(cl)
lags, err := adm.Lag(ctx, "billing-order-events")
if err != nil {
	return fmt.Errorf("lag: %w", err)
}
for group, l := range lags {
	if err := l.Error(); err != nil {
		return fmt.Errorf("lag for %s: %w", group, err)
	}
	groupLag.WithLabelValues(group).Set(float64(l.Lag.Total()))
}
```

Alert on lag that keeps growing, not on a fixed number; a batch topic is allowed to lag for minutes.
