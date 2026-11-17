---
name: go-kafka
description: "Use when a Go service produces to or consumes from Kafka or a Kafka-compatible broker (Redpanda, managed Kafka) with franz-go (github.com/twmb/franz-go, kgo, kadm, sr): building the client, producer settings (acks, idempotence, linger, compression), ProduceSync versus Produce with a promise, Flush, record keys for per-entity ordering, headers, consumer groups and PollFetches, checking fetch errors, committing offsets after processing (DisableAutoCommit, AutoCommitMarks, MarkCommitRecords), rebalances and OnPartitionsRevoked, a worker per partition, retries and dead-letter topics, idempotent handlers, the transactional outbox, exactly-once with GroupTransactSession, schemas and the schema registry, topic creation, SASL and TLS, lag, metrics, tracing (kotel, kprom, kzap), graceful shutdown, and tests with kfake or a broker in a container. Also when choosing a Go Kafka client (franz-go versus sarama, segmentio/kafka-go, confluent-kafka-go) or reviewing Kafka code. Holds the kafka-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go services that talk to Kafka-protocol brokers with franz-go v1.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Kafka from Go (team)

**Principle:** A record counts as sent only when the broker acknowledged it, and as handled only when its offset is committed after the work is done; everything else (batching, concurrency, retries) is tuned inside those two lines.

The team talks to Kafka with [franz-go](https://github.com/twmb/franz-go) (`kgo`), the pure-Go client. This skill is the team's pattern for it. No established public Kafka skill exists to vendor for Go: Confluent's [agent skills](https://github.com/confluentinc/agent-skills) cover the Java and Python clients, Kafka Streams and Confluent Cloud tuning, and samber/cc-skills-golang has no messaging skill. Their broker-side advice (topic sizing, tuning trade-offs) is still worth reading; where it names client settings, translate them with the table in [references/producer.md](references/producer.md).

The project wins where it differs ([go-how-to](../go-how-to/SKILL.md), rule 1). Read `go.mod` first: the code below is franz-go v1.22 (`github.com/twmb/franz-go/pkg/kgo`), which needs Go 1.26, with its separate modules `pkg/kadm`, `pkg/sr`, `pkg/kfake` and `plugin/kzap`, `plugin/kotel`, `plugin/kprom`. A project on an older Go keeps the franz-go release its toolchain supports; the patterns are the same.

Related: [go-concurrency](../go-concurrency/SKILL.md) (goroutine owners, context, shutdown), [go-database](../go-database/SKILL.md) (the outbox table and its transaction), [go-testing](../go-testing/SKILL.md) (`test-real-database`, no sleeps), [go-security](../go-security/SKILL.md) (`sec-tls-verify`, `sec-no-secrets-in-logs`), [go-observability](../go-observability/SKILL.md) (zap, metrics, traces), [go-project-layout](../go-project-layout/SKILL.md) (where the client and the handlers go), [go-knadh-koanf](../go-knadh-koanf/SKILL.md) (the `kafka` settings block), [go-error-handling](../go-error-handling/SKILL.md) (wrapping, `errors.Is`), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Publishing an event or command to a topic, or adding a consumer for one
- Choosing producer or consumer settings, a commit strategy, or a record key
- A consumer that loses records, processes them twice, stalls, or lags
- Writing to the database and to Kafka in one operation
- Testing a producer or a consumer; reviewing a Go diff that touches `kgo`

## The team's rules

- **One long-lived client per role**, built once in the Platform package (`internal/kafka`) from the settings block and handed to constructors. Never a client per request or per message.
- **Producing:** acks from all in-sync replicas and idempotence stay on (franz-go's defaults). Every produce result is checked: `ProduceSync(...).FirstErr()`, or a promise that handles `err`. A request path that must not lose the event uses `ProduceSync`, or the outbox.
- **Keys:** a record about an entity carries that entity's ID as its key, so its events stay in order on one partition.
- **Consuming:** every poll checks `fetches.Errors()`; an offset is committed only after its record is processed; handlers tolerate a record delivered twice.
- **Failures:** a record that still fails after a few retries goes to a dead-letter topic with the error in its headers, and its offset is committed. A partition is never blocked forever, and a record is never dropped silently.
- **Concurrency:** one worker per assigned partition, or a fixed pool keyed by partition; never a goroutine per record.
- **Database and Kafka together:** the transactional outbox, never "commit the transaction, then produce".
- **Topics** are created by infrastructure code or an admin step with explicit partitions, replication and configs, never by auto-creation from the application.
- **Shutdown:** stop polling, finish in-flight work, commit, then `Close`; producers `Flush` before `Close`.

## Team decisions

1. **Client: franz-go (`kgo`).**

   | Client | Status | Why not (or why) |
   |---|---|---|
   | `github.com/twmb/franz-go` | **Adopted** | Pure Go (static builds, easy cross-compiling), feature-complete for Kafka 0.8 through 4.x: idempotent and transactional producers, exactly-once, cooperative-sticky rebalancing by default, KIP-848 groups, all SASL mechanisms, an admin package (`kadm`), a schema-registry client (`sr`), an in-process fake cluster (`kfake`), zap, OpenTelemetry and Prometheus plugins. Actively released (v1.22.x in 2026); among the fastest and most memory-efficient Go clients. |
   | `github.com/confluentinc/confluent-kafka-go/v2` | Not adopted | Wraps librdkafka through cgo: C toolchain in every build, harder static and cross builds, C-level crashes. Choose it only when Confluent support or its serializers are a hard requirement. |
   | `github.com/IBM/sarama` | Not adopted | Pure Go and maintained, but a larger, older API with more ways to lose records (async producer error channels that must be drained, consumer-group handler lifecycle); transactions arrived late. |
   | `github.com/segmentio/kafka-go` | Not adopted | Simple API, but releases have slowed (v0.4.x), no transactions or exactly-once, the default `Writer` balancer ignores keys (round-robin), and it trails on newer protocol features. |

2. **Delivery is at-least-once, and handlers are idempotent.** Exactly-once (`TransactionalID`, `GroupTransactSession`) is used only for consume-transform-produce between Kafka topics, where its cost is justified; it does not cover side effects outside Kafka, such as a database write or an HTTP call.
3. **Payloads:** JSON with a versioned envelope (`type`, `version`, `id`, `occurred_at`, `data`) and a topic per event stream with a major version in its name (`orders.v1`). When the project runs a schema registry, Avro or Protobuf through `franz-go/pkg/sr` instead. A breaking change is a new topic version, not an edited schema.
4. **Logging and telemetry:** the team's zap logger through `kzap` at `Info` (`Debug` floods); traces through `kotel`; metrics through `kprom` or the project's OpenTelemetry meter; consumer lag measured outside the consumer (`kadm.Client.Lag` or the broker's exporter).
5. **Tests:** handler logic is a plain function tested without a broker. The client wiring (poll loop, commits, DLQ, shutdown) is tested against `kfake`, the in-process fake cluster that speaks the real Kafka protocol, so the real client code runs. Behaviour that depends on the broker (transactions end to end, compaction, ACLs, SASL) is tested against the broker image production runs, through testcontainers. No hand-written mock of `kgo.Client` with expectations on calls ([references/testing.md](references/testing.md)).

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [kafka-check-errors](rules/kafka-check-errors.md) | Check every produce result and every fetch error | CRITICAL | scan, review |
| [kafka-commit-after-processing](rules/kafka-commit-after-processing.md) | Commit an offset only after its record is processed | CRITICAL | scan (candidates), review |
| [kafka-outbox-for-db-writes](rules/kafka-outbox-for-db-writes.md) | Publish database changes through a transactional outbox | CRITICAL | review |
| [kafka-durable-writes](rules/kafka-durable-writes.md) | Keep all-ISR acks and idempotence; declare topics explicitly | HIGH | scan |
| [kafka-key-for-ordering](rules/kafka-key-for-ordering.md) | Key records by the entity whose order matters | HIGH | review |
| [kafka-idempotent-handler](rules/kafka-idempotent-handler.md) | Make every handler safe to run twice for one record | HIGH | review, test |
| [kafka-poison-message-dlq](rules/kafka-poison-message-dlq.md) | Retry a bounded number of times, then dead-letter and move on | HIGH | review |
| [kafka-bounded-concurrency](rules/kafka-bounded-concurrency.md) | Process with one worker per partition, never a goroutine per record | HIGH | scan (candidates), review |
| [kafka-graceful-shutdown](rules/kafka-graceful-shutdown.md) | Stop polling, finish, commit, flush, then close | HIGH | scan (candidates), review |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, and against the checklist below. Follow each record from the poll to the commit, and each produced record to the place its error is read.
5. **Report** in the format of [agent-skills-authoring](../agent-skills-authoring/SKILL.md) ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test the project doesn't have.

## Review checklist

- [ ] One client per role, built in the Platform package, closed on shutdown
- [ ] No `LeaderAck`, `NoAck`, `DisableIdempotentWrite` or `AllowAutoTopicCreation` in service code
- [ ] Every `ProduceSync` result and every promise `err` is checked; no `Produce(ctx, r, nil)`
- [ ] Records about an entity are keyed by its ID
- [ ] Every poll checks `fetches.Errors()` and `IsClientClosed()`
- [ ] Offsets committed after processing: synchronous processing with autocommit, or `DisableAutoCommit`/`AutoCommitMarks` with commits from the workers, and a blocking commit in `OnPartitionsRevoked`
- [ ] Handlers idempotent (dedup by event ID, upsert, or a processed-events table in the same transaction)
- [ ] Bounded retries, then a dead-letter topic; no infinite retry, no silent skip
- [ ] One worker per partition or a fixed pool; no `go` per record
- [ ] Database writes that must be announced go through the outbox
- [ ] Credentials from settings or a mounted file, TLS verified, nothing secret logged
- [ ] Tests: handler unit tests, the loop against `kfake` or a real broker; no `time.Sleep` waits

## 1. The client

The Platform package builds clients from the settings block; Domain code depends on a small interface it owns (`Publisher`), and consumer handlers live in the Surface layer next to the HTTP handlers: they decode, validate and call a Domain service ([go-project-layout](../go-project-layout/SKILL.md)).

```go
// Package kafka builds the service's Kafka clients from its settings.
package kafka

// Config is the kafka settings block.
type Config struct {
	Brokers      []string      `koanf:"brokers"`       // seed brokers, host:port
	ClientID     string        `koanf:"client_id"`     // shows up in broker logs and quotas
	Group        string        `koanf:"group"`         // consumer group; empty for producers
	Topics       []string      `koanf:"topics"`        // topics this consumer reads
	SASL         SASL          `koanf:"sasl"`
	TLS          bool          `koanf:"tls"`
	CAFile       string        `koanf:"ca_file"`       // empty: the system roots
	DialTimeout  time.Duration `koanf:"dial_timeout"`  // default 10s
}

func baseOpts(cfg Config, log *zap.Logger) ([]kgo.Opt, error) {
	opts := []kgo.Opt{
		kgo.SeedBrokers(cfg.Brokers...),
		kgo.ClientID(cfg.ClientID),
		kgo.DialTimeout(cfg.DialTimeout),
		kgo.WithLogger(kzap.New(log.Named("kafka"), kzap.Level(kgo.LogLevelInfo))),
	}
	if cfg.TLS {
		tc, err := cfg.tlsConfig() // MinVersion TLS 1.2, RootCAs from CAFile; never InsecureSkipVerify
		if err != nil {
			return nil, fmt.Errorf("kafka tls: %w", err)
		}
		opts = append(opts, kgo.DialTLSConfig(tc))
	}
	if cfg.SASL.Mechanism != "" {
		m, err := cfg.SASL.mechanism() // SCRAM-SHA-512 or PLAIN, password from a mounted file
		if err != nil {
			return nil, fmt.Errorf("kafka sasl: %w", err)
		}
		opts = append(opts, kgo.SASL(m))
	}
	return opts, nil
}

// NewProducer returns a producing client and checks that a broker answers.
func NewProducer(ctx context.Context, cfg Config, log *zap.Logger) (*kgo.Client, error) {
	opts, err := baseOpts(cfg, log)
	if err != nil {
		return nil, err
	}
	cl, err := kgo.NewClient(opts...) // defaults: acks=all, idempotent, linger 10ms, snappy
	if err != nil {
		return nil, fmt.Errorf("kafka producer: %w", err)
	}
	if err := cl.Ping(ctx); err != nil {
		cl.Close()
		return nil, fmt.Errorf("kafka producer: ping: %w", err)
	}
	return cl, nil
}
```

Producer settings, SASL, TLS, schemas, tracing and metrics: [references/producer.md](references/producer.md) and [references/operations.md](references/operations.md).

## 2. Producing

```go
// Publish sends one event and returns once the in-sync replicas have it.
func (p *Publisher) Publish(ctx context.Context, ev Event) error {
	value, err := json.Marshal(ev)
	if err != nil {
		return fmt.Errorf("encode %s: %w", ev.Type, err)
	}
	rec := &kgo.Record{
		Topic: p.topic,               // "orders.v1"
		Key:   []byte(ev.OrderID),    // one order's events stay in order
		Value: value,
		Headers: []kgo.RecordHeader{
			{Key: "event-type", Value: []byte(ev.Type)},
			{Key: "schema-version", Value: []byte("1")},
		},
	}
	if err := p.cl.ProduceSync(ctx, rec).FirstErr(); err != nil {
		return fmt.Errorf("publish %s for order %s: %w", ev.Type, ev.OrderID, err)
	}
	return nil
}
```

- **`ProduceSync`** when the caller must know (a request that answers only after the event is durable). Batching still happens across concurrent callers.
- **`Produce` with a promise** for throughput (a relay or a pipeline). The promise runs serially on the client's goroutine: keep it short, never block in it, and never call `Flush` or a blocking produce from it. Canceling the context passed to `Produce` cancels the buffered record, so a background send outlives a request only with `context.WithoutCancel(ctx)`.
- **Partitioner:** franz-go hashes keys with murmur2, like the Java client, so keyed records land where Java producers put them. A record with no key is spread across partitions; use one only when order doesn't matter.

Async producing, batching and compression, the settings map to Java names, and transactions: [references/producer.md](references/producer.md). The outbox: [rules/kafka-outbox-for-db-writes.md](rules/kafka-outbox-for-db-writes.md).

## 3. Consuming

The default shape: autocommit on, records processed synchronously inside the poll loop. franz-go's autocommit commits only what earlier polls returned, so a record is committed after the loop came back for more, which means after it was processed.

```go
// Run consumes until ctx is canceled, then commits and leaves the group.
func (c *Consumer) Run(ctx context.Context) error {
	for {
		fetches := c.cl.PollFetches(ctx)
		if fetches.IsClientClosed() || ctx.Err() != nil {
			return nil
		}
		for _, fe := range fetches.Errors() {
			c.log.Error("kafka fetch", zap.String("topic", fe.Topic), zap.Int32("partition", fe.Partition), zap.Error(fe.Err))
		}
		fetches.EachRecord(func(r *kgo.Record) {
			c.handle(ctx, r) // retries, then dead-letters; never returns with the record unhandled
		})
	}
}
```

When processing is handed to workers (one per partition, for throughput), autocommit no longer implies "processed": switch to `kgo.AutoCommitMarks()` and have each worker call `MarkCommitRecords` after it finishes, or `kgo.DisableAutoCommit()` with `CommitRecords` from the worker plus a blocking commit in `OnPartitionsRevoked`. The patterns, rebalance callbacks, `BlockRebalanceOnPoll`, retries and the dead-letter topic, exactly-once and lag: [references/consumer.md](references/consumer.md).

## 4. Shutdown

`main` owns the lifecycle ([go-concurrency](../go-concurrency/SKILL.md)): on SIGTERM it cancels the context the consumer polls with, waits for `Run` to return (workers finish their current record and commit), then closes the consumer, then flushes and closes the producers, within the pod's grace period.

```go
<-ctx.Done()                      // SIGTERM
wg.Wait()                         // consumer loop and its workers returned
consumer.Close()                  // commits (autocommit), leaves the group
flushCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
if err := producer.Flush(flushCtx); err != nil {
	log.Error("kafka flush on shutdown", zap.Error(err))
}
producer.Close()                  // Close fails whatever is still buffered
```

## 5. Testing

Handlers are plain functions over a decoded event: table tests, no broker. The loop and its commits run against `kfake` in the same process; transactions, SASL and broker configs against a broker in a container. Setup, helpers and what to assert: [references/testing.md](references/testing.md).

## References

- [references/producer.md](references/producer.md): producer options, async producing, batching and compression, settings named like the Java client, transactions
- [references/consumer.md](references/consumer.md): commit strategies, rebalances, a worker per partition, retries and dead letters, exactly-once, lag
- [references/operations.md](references/operations.md): settings and secrets, SASL and TLS, topics through `kadm` or infrastructure code, schemas and `sr`, logs, traces and metrics
- [references/testing.md](references/testing.md): handler tests, `kfake`, testcontainers, what each level proves
- franz-go: [documentation](https://pkg.go.dev/github.com/twmb/franz-go/pkg/kgo), [examples](https://github.com/twmb/franz-go/tree/master/examples) (goroutine per partition, DLQ, transactions, testing with kfake)
- Kafka: [producer configs](https://kafka.apache.org/documentation/#producerconfigs), [consumer configs](https://kafka.apache.org/documentation/#consumerconfigs), [design: delivery semantics](https://kafka.apache.org/documentation/#semantics)
