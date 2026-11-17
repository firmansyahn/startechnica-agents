# Operations

Connection options in depth, logging, metrics and tracing, migrations, and when to reach for ch-go. The connection rule is `ch-one-conn` ([../SKILL.md](../SKILL.md)).

## Options

| Option | Default | Team setting |
|---|---|---|
| `Addr` | | Every host of the shard or the load-balanced address, from settings |
| `Protocol` | `clickhouse.Native` | Native; `clickhouse.HTTP` only behind an HTTP-only proxy |
| `Auth` | `default` user, no password | A user per service, with only the grants it needs (insert into its tables, select from its views) |
| `TLS` | nil (plain) | A verified `*tls.Config` whenever the server isn't on the same host; never `InsecureSkipVerify` (`sec-tls-verify`) |
| `DialTimeout` | 30s | 5s: a start against a wrong address should fail fast |
| `ReadTimeout` | | Leave unset; the context deadline bounds each call |
| `MaxIdleConns` | 5 | The usual number of concurrent queries plus open batches |
| `MaxOpenConns` | `MaxIdleConns + 5` | A hard cap below the user's share of the server's `max_concurrent_queries` |
| `ConnMaxLifetime` | 1h | 1h; shorter behind a load balancer that should rebalance |
| `ConnOpenStrategy` | `ConnOpenInOrder` | `ConnOpenRoundRobin` over equal replicas; in order when later hosts are fallbacks |
| `Compression` | none | `&clickhouse.Compression{Method: clickhouse.CompressionLZ4}`; ZSTD when bandwidth costs more than CPU |
| `Settings` | | Ceilings that hold for every query (`max_execution_time`); the rest per query on the context |
| `ClientInfo` | | The service name and version, visible in `system.query_log` |
| `Logger` | nil | nil, or a bridge from zap (below) |
| `BlockBufferSize` | 2 | Raise per query with `WithBlockBufferSize` for big reads, not globally |

A DSN (`clickhouse://user:pass@host:9440/db?secure=true&dial_timeout=5s&compress=lz4`) parsed with `clickhouse.ParseDSN` gives the same `*Options`; the team builds `Options` from the typed settings block instead, so each field is validated and documented ([go-knadh-koanf](../../go-knadh-koanf/SKILL.md)). Never log the DSN or the options: they carry the password (`sec-no-secrets-in-logs`).

**Health:** the readiness probe runs `conn.Ping(ctx)` with a short timeout; liveness doesn't depend on ClickHouse.

## Logging

The store logs failures with the injected zap logger, with the operation, the table, the row count and the error ([go-observability](../../go-observability/SKILL.md)); never the query's argument values, which may carry personal data.

The driver's own logs (`Options.Logger`, a `*slog.Logger`) are for debugging the driver; leave them off in production. When needed, bridge zap so they go through the same core:

```go
import "go.uber.org/zap/exp/zapslog"

opts.Logger = slog.New(zapslog.NewHandler(log.Core(), zapslog.WithName("clickhouse")))
```

## Metrics

- **Pool:** gauges from `conn.Stats()` (`Open`, `Idle`, `MaxOpenConns`), sampled by a collector; open close to max means queries wait for a connection.
- **Store calls:** a histogram of call duration by operation (`op="daily_page_views"`) and a counter of errors by operation and exception code. Labels stay bounded: never the query text or a tenant ID.
- **Writer:** rows queued (gauge), rows flushed, rows dropped and flush failures (counters), flush duration and rows per flush (histograms). Rows per flush well under the target means `MaxAge` fires first: too many small inserts.
- **Server side** (scraped from ClickHouse, not the service): parts per partition, merges in progress, rejected and delayed inserts, `system.asynchronous_insert_log` failures.

## Tracing

clickhouse-go doesn't create client spans. Wrap each store method in a span and pass its context to the server, which records its own spans in `system.opentelemetry_span_log` when tracing is enabled there:

```go
func (s *Store) DailyPageViews(ctx context.Context, siteID uint32, from, to time.Time) ([]DailyCount, error) {
	ctx, span := s.tracer.Start(ctx, "chstore.DailyPageViews",
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(attribute.String("db.system.name", "clickhouse"), attribute.String("db.collection.name", "page_views")))
	defer span.End()
	ctx = clickhouse.Context(ctx,
		clickhouse.WithSpan(span.SpanContext()),
		clickhouse.WithSettings(clickhouse.Settings{"log_comment": "DailyPageViews"}),
	)
	// ... query; on error: span.RecordError(err); span.SetStatus(codes.Error, "query failed")
}
```

- `log_comment` (or `clickhouse.WithQueryID(id)`) lets an operator find the query in `system.query_log` from a slow-request trace.
- Don't put the SQL arguments in span attributes.

## Migrations

The team's rule is the same as for PostgreSQL ([go-database](../../go-database/SKILL.md)): the project's migration tool, one migration per change, never edited after it ships, reviewed by a person who knows the data. For ClickHouse:

- **golang-migrate** has a ClickHouse driver: `clickhouse://host:9000?username=…&password=…&database=…&x-multi-statement=true&x-migrations-table-engine=MergeTree`. `x-multi-statement` splits on `;` and runs the parts one by one, with no transaction: keep one statement per migration where possible, since a failure halfway is fixed by hand. On a cluster add `x-cluster-name=<cluster>` and a replicated `x-migrations-table-engine`, and write `ON CLUSTER` and `Replicated*MergeTree` in the migrations themselves.
- **ORDER BY can't change** on an existing table: plan it from the queries first (`schema-pk-plan-before-creation`, `schema-pk-cardinality-order`). A key change is a new table filled with `INSERT … SELECT`, then a rename (`EXCHANGE TABLES` on Atomic databases).
- **Adding a column** with a `DEFAULT` is cheap (metadata only); dropping or changing a type rewrites data: plan it as a mutation an operator watches, not a routine deploy step.
- **Engines and settings in the migration:** `ReplacingMergeTree(version)` for tables that take new versions, `non_replicated_deduplication_window` on a plain `MergeTree` that receives retried inserts, `TTL` for retention, a partition key only for lifecycle (`schema-partition-lifecycle`, `schema-partition-start-without`).
- Use the schema in the store's tests: the test helper runs the same migrations ([testing.md](testing.md)).

## ch-go

[ch-go](https://github.com/ClickHouse/ch-go) is the low-level client clickhouse-go is built on: columnar `proto.Col*` types, no reflection, and the lowest CPU per row. Use it for an ingest path only when profiling shows clickhouse-go's encoding is the limit (millions of rows per second per process). Everything else in this skill still applies: one client pool, batches, contexts, retry-safe inserts. It has no `database/sql`, no struct mapping and no query parameters beyond what you build, so queries stay on clickhouse-go.
