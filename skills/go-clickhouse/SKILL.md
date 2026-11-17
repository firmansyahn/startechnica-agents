---
name: go-clickhouse
description: "Use when a Go service writes to or queries ClickHouse with clickhouse-go v2, or when reviewing such code: the one connection pool (clickhouse.Open, driver.Conn, Options, TLS, compression, several hosts), contexts and deadlines, per-query settings and parameters (clickhouse.Context, WithSettings, Named, {name:Type}), batch inserts (PrepareBatch, Append, Send, Close), a buffered writer that flushes by size, time and on shutdown, async inserts (wait_for_async_insert), retries and deduplication (insert_deduplication_token, ReplacingMergeTree), avoiding ALTER UPDATE/DELETE mutations, scanning (ch tags, Select, ScanStruct), type mapping (DateTime64 and time zones, Nullable, Decimal, UUID), clickhouse.Exception errors, migrations, metrics and spans, and tests against a real ClickHouse (testcontainers). Choosing clickhouse-go, database/sql or ch-go. Schema and query design: clickhouse-best-practices. Holds the ch-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go services that use ClickHouse through clickhouse-go v2.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# ClickHouse from a Go service (team)

**Principle:** ClickHouse is fed in large, retry-safe batches and queried with bound parameters under the caller's deadline; the service never treats it as a row-at-a-time OLTP database.

This skill is the team's pattern for the Go side: the client, the connection, inserts, queries, retries and tests. **Schema, query and insert design** (ORDER BY keys, types, partitions, joins, materialized views, batch sizes, mutations) is the vendored [clickhouse-best-practices](../clickhouse-best-practices/SKILL.md), ClickHouse Inc's official skill: read its rules when a change adds or alters a table or a query, and cite them by name (`schema-pk-filter-on-orderby`). Where it and this skill differ, this skill wins for service code (see "Team decisions").

The project wins where it differs ([go-how-to](../go-how-to/SKILL.md), rule 1). Read `go.mod` first: the code below is clickhouse-go v2.51 (`github.com/ClickHouse/clickhouse-go/v2`), which needs Go 1.26; older v2 releases have the same API apart from newer options.

Related: [go-database](../go-database/SKILL.md) (SQL in the data-access layer, no ORM, real databases in tests), [go-concurrency](../go-concurrency/SKILL.md) (contexts, the writer goroutine and its shutdown), [go-security](../go-security/SKILL.md) (`sec-sql-parameterized`, `sec-tls-verify`, `sec-no-secrets-in-logs`), [go-observability](../go-observability/SKILL.md) (zap, metrics, spans), [go-project-layout](../go-project-layout/SKILL.md) (the Platform layer), [go-knadh-koanf](../go-knadh-koanf/SKILL.md) (the `clickhouse` settings block), [go-testing](../go-testing/SKILL.md) (`test-real-database`), [go-how-to](../go-how-to/SKILL.md).

## When to use

- Adding ClickHouse to a service, or changing how it connects
- Writing events, metrics or logs into a table; building or changing an ingest path
- Adding or changing a query a handler or report runs
- A "too many parts", memory-limit or timeout error; duplicated or missing rows after a retry or a restart
- Reviewing a Go diff that touches ClickHouse code or a ClickHouse migration

## The team's rules

- **One `driver.Conn` per process**, opened in the Platform package that owns ClickHouse, pinged at start, passed to constructors, closed on shutdown. It is a pool and safe for concurrent use (`ch-one-conn`).
- **SQL lives in that package** with the other data access ([go-database](../go-database/SKILL.md), `db-sql-in-data-layer`); handlers call typed methods.
- **Values are bound, never formatted into SQL** (`ch-bind-parameters`): `?` placeholders, `clickhouse.Named`, or server-side `{name:Type}` parameters; identifiers through `{name:Identifier}` or an allow-list.
- **Every call takes the caller's context with a deadline** (`ch-context-deadline`); the driver turns a deadline over one second into `max_execution_time` on the server.
- **Inserts are batched**: thousands of rows per `INSERT`, about one insert per second per table, through `PrepareBatch` or a buffered writer, never one `Exec` per row (`ch-batch-inserts`). Each batch is closed on every path (`ch-close-batch`).
- **Async inserts wait for the flush** (`wait_for_async_insert=1`) (`ch-async-insert-wait`).
- **A retried insert sends the same rows in the same order**, so ClickHouse's insert deduplication can drop the repeat; tables that must not duplicate say how they deduplicate (`ch-idempotent-retries`).
- **No `ALTER TABLE … UPDATE/DELETE` and no `OPTIMIZE … FINAL` from service code** (`ch-no-mutations`): model changes as new rows.
- **Rows are closed and `rows.Err()` checked**, or read with `Select` (`ch-close-rows`).
- **Schema changes are migrations**, reviewed by a person who knows the data, with ORDER BY planned first (`schema-pk-plan-before-creation`).

## Team decisions

1. **The client is clickhouse-go v2 through its native API** (`clickhouse.Open` → `driver.Conn`) over the native TCP protocol (9000, or 9440 with TLS). It has the full feature set: `PrepareBatch` and columnar appends, per-query settings and parameters in the context, progress and profile callbacks, strict typed scanning.

   | Client | Status | Why |
   |---|---|---|
   | `clickhouse-go/v2`, native API (`clickhouse.Open`) | **Adopted** | Official, maintained by ClickHouse; batches, settings, typed scanning; Native format on the wire |
   | `clickhouse-go/v2` through `database/sql` (`clickhouse.OpenDB`) | Only for tools that need `*sql.DB` (golang-migrate) | Batches through transactions and `Prepare`, fewer features, an extra layer of reflection |
   | `ch-go` (`github.com/ClickHouse/ch-go`) | Only for an ingest path where profiling shows the client's CPU is the limit (millions of rows per second) | Low level, columnar, fastest; no `database/sql`, no struct mapping, more code |
   | clickhouse-go v1, HTTP-only `database/sql` drivers, ORM-style wrappers | Not adopted | v1 is deprecated; the others add an ORM or drop batching and settings (no ORM, as in go-database) |

   HTTP (`Protocol: clickhouse.HTTP`, port 8123/8443) only where a load balancer or proxy requires it; it is slightly slower and `Batch.Flush` is a no-op there.
2. **Inserts are batched in the service.** A service that receives events one at a time buffers them in a writer that flushes by size or age and on shutdown ([references/inserts.md](references/inserts.md)). Server-side async inserts are the fallback when many independent producers can't batch, never with fire-and-forget.
3. **Retry-safe by construction:** an insert that may be retried (a consumer re-reading a queue, a job re-run) carries the same rows in the same order and, where the source has a natural key (a queue partition and offset range, a job ID), an `insert_deduplication_token`. Tables whose readers can't tolerate duplicates use `ReplacingMergeTree` with a version column.
4. **No mocked ClickHouse.** Store code is tested against a real server (testcontainers' ClickHouse module, or a server the CI job provides), one fresh database per test ([references/testing.md](references/testing.md)); `driver.Conn` is not mocked. Service code above the store is tested with a hand-written fake of the store's interface.
5. **Logging:** the driver logs through a `*slog.Logger` (`Options.Logger`); leave it nil, and log failures from the store with the injected zap logger. When driver logs are wanted, bridge the same core (`slog.New(zapslog.NewHandler(log.Core()))`, [go-observability](../go-observability/SKILL.md) decision 1).
6. **Where the team differs from clickhouse-best-practices:** its examples are Python and SQL; the Go shape is here. Its `agent-*` rules (MCP, CLI, schema discovery) are for an agent exploring a server interactively, not for service code. Its insert rules are adopted as they are (10,000 to 100,000 rows per insert, async inserts with `wait_for_async_insert=1`, no `ALTER UPDATE`, no `OPTIMIZE FINAL`).

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ch-bind-parameters](rules/ch-bind-parameters.md) | Bind values as parameters, never format them into SQL | CRITICAL | scan (candidates), review |
| [ch-one-conn](rules/ch-one-conn.md) | Open one connection pool per process and close it on shutdown | HIGH | scan (candidates), review |
| [ch-context-deadline](rules/ch-context-deadline.md) | Run every call with the caller's context and a deadline | MEDIUM | scan |
| [ch-close-rows](rules/ch-close-rows.md) | Close rows and check rows.Err | HIGH | scan |
| [ch-batch-inserts](rules/ch-batch-inserts.md) | Insert in large batches, never one row per INSERT | HIGH | scan (candidates), review |
| [ch-close-batch](rules/ch-close-batch.md) | Defer Close right after PrepareBatch | HIGH | scan |
| [ch-async-insert-wait](rules/ch-async-insert-wait.md) | Wait for the flush when using async inserts | HIGH | scan |
| [ch-idempotent-retries](rules/ch-idempotent-retries.md) | Retry an insert with the same rows in the same order | HIGH | review |
| [ch-no-mutations](rules/ch-no-mutations.md) | Don't run ALTER UPDATE/DELETE or OPTIMIZE FINAL from service code | HIGH | scan, review |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go' '*.sql'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check (only in files that import clickhouse-go, apart from the SQL-text checks). On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above and the checklist below. For a migration or a new query, read the matching review procedure in [clickhouse-best-practices](../clickhouse-best-practices/SKILL.md) ("Review Procedures") and cite its rules.
5. **Report** in the format of [agent-skills-authoring](../agent-skills-authoring/SKILL.md) ("Scan scripts and findings"), ordered by impact.

## Review checklist

- [ ] One `driver.Conn`, opened at start with a `Ping`, closed on shutdown; TLS verified; credentials from settings, never logged
- [ ] Every value bound (`?`, `Named`, `{name:Type}`); identifiers from an allow-list or `{name:Identifier}`
- [ ] Every call with the caller's context and a deadline; no `context.Background()` in request code
- [ ] Inserts batched (thousands of rows, about one insert per second per table); batches closed on every path; the writer flushes on shutdown
- [ ] Async inserts only with `wait_for_async_insert=1`
- [ ] Retries resend the same batch; a deduplication token where the source has a natural key; duplicates handled by the table engine where readers need it
- [ ] No `ALTER TABLE … UPDATE/DELETE`, `OPTIMIZE … FINAL` or per-request `DELETE` in service code
- [ ] Rows closed and `rows.Err()` checked; scans into the exact Go types (`UInt64` → `uint64`)
- [ ] Queries filter on the ORDER BY prefix and select named columns with a `LIMIT` (`schema-pk-filter-on-orderby`)
- [ ] Schema change as a new migration; ORDER BY and types reviewed against clickhouse-best-practices
- [ ] Store tests against a real ClickHouse, one database per test

## 1. Connecting

```go
// Package chstore owns the ClickHouse connection and every query the service runs.
package chstore

type Config struct {
	Addrs       []string      `koanf:"addrs"`        // host:port, native protocol (9440 with TLS)
	Database    string        `koanf:"database"`
	Username    string        `koanf:"username"`
	Password    string        `koanf:"password"`     // or password_file; never logged
	TLS         bool          `koanf:"tls"`
	DialTimeout time.Duration `koanf:"dial_timeout"` // default 5s
	MaxOpen     int           `koanf:"max_open_conns"`
	MaxIdle     int           `koanf:"max_idle_conns"`
}

func Open(ctx context.Context, cfg Config) (driver.Conn, error) {
	opts := &clickhouse.Options{
		Addr: cfg.Addrs,
		Auth: clickhouse.Auth{Database: cfg.Database, Username: cfg.Username, Password: cfg.Password},
		DialTimeout:      cfg.DialTimeout,
		MaxOpenConns:     cfg.MaxOpen,
		MaxIdleConns:     cfg.MaxIdle,
		ConnMaxLifetime:  time.Hour,
		ConnOpenStrategy: clickhouse.ConnOpenRoundRobin, // spread connections over the hosts
		Compression:      &clickhouse.Compression{Method: clickhouse.CompressionLZ4},
		Settings: clickhouse.Settings{
			"max_execution_time": 60, // a ceiling; a context deadline sets a lower one per query
		},
		ClientInfo: clickhouse.ClientInfo{Products: []struct{ Name, Version string }{{Name: "orders-api", Version: version}}},
	}
	if cfg.TLS {
		opts.TLS = &tls.Config{MinVersion: tls.VersionTLS12} // verified; never InsecureSkipVerify (sec-tls-verify)
	}
	conn, err := clickhouse.Open(opts)
	if err != nil {
		return nil, fmt.Errorf("open clickhouse: %w", err)
	}
	if err := conn.Ping(ctx); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("ping clickhouse: %w", err)
	}
	return conn, nil
}
```

- `Open` doesn't dial; `Ping` does. The root opens it once, `defer conn.Close()` after the writer has flushed (section 3).
- **Pool size:** `MaxOpenConns` bounds concurrent queries plus open batches (a batch holds a connection from `PrepareBatch` until `Send`/`Close`). Defaults are 5 idle and idle + 5 open; size it to the service's real concurrency, not higher than the server's `max_concurrent_queries` share for this user.
- **Compression:** LZ4 by default; ZSTD when bandwidth or egress costs matter more than CPU.
- **Several hosts:** list them in `Addr`; `ConnOpenInOrder` (the default) treats the later ones as fallbacks, `ConnOpenRoundRobin` spreads load. On a cluster, insert into the local replicated tables through a load-balanced address or a `Distributed` table, as the schema decides.
- **Settings in the file:** the `clickhouse` block in the settings file ([go-knadh-koanf](../go-knadh-koanf/SKILL.md)), the password inline or as a mounted `password_file`.

## 2. Querying

```go
type DailyCount struct {
	Day   time.Time `ch:"day"`
	Count uint64    `ch:"count"` // count() is UInt64: scanning into int fails
}

func (s *Store) DailyPageViews(ctx context.Context, siteID uint32, from, to time.Time) ([]DailyCount, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	ctx = clickhouse.Context(ctx,
		clickhouse.WithSettings(clickhouse.Settings{"log_comment": "DailyPageViews"}),
	)
	var out []DailyCount
	err := s.conn.Select(ctx, &out, `
		SELECT toDate(ts) AS day, count() AS count
		FROM page_views
		WHERE site_id = ? AND ts >= ? AND ts < ?
		GROUP BY day
		ORDER BY day
		LIMIT 1000`, siteID, from, to)
	if err != nil {
		return nil, fmt.Errorf("daily page views for site %d: %w", siteID, err)
	}
	return out, nil
}
```

- `Select` scans every row into a slice of structs by `ch` tag and closes the rows; use `Query` with `rows.Next`/`ScanStruct` only to stream a large result, then `defer rows.Close()` and check `rows.Err()` (`ch-close-rows`).
- **Parameters:** `?` placeholders are bound client-side by the driver; `clickhouse.Named("site", id)` with `@site` in the query, or server-side `{site:UInt32}` with `clickhouse.WithParameters` or `Named` (server 22.8+), which the server types and checks. Table or column names from input: `{table:Identifier}` or an allow-list (`ch-bind-parameters`).
- **Query design:** filter on a prefix of the table's ORDER BY (`schema-pk-filter-on-orderby`), name the columns (columnar storage reads only those), put a `LIMIT` on anything a user can widen, filter before joins (`query-join-filter-before`). Use `FINAL` on a `ReplacingMergeTree` only on queries that must be exact, or deduplicate with `argMax(value, version)` and `GROUP BY`.
- **Errors:** `errors.As(err, &exc)` with `var exc *clickhouse.Exception` gives the server's `Code` (60 unknown table, 159 timeout, 241 memory limit, 252 too many parts). Translate them to the service's errors at the store; don't match on message text.

Types, time zones and NULLs: [references/queries.md](references/queries.md).

## 3. Inserting

```go
func (s *Store) InsertPageViews(ctx context.Context, views []PageView) (err error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	batch, err := s.conn.PrepareBatch(ctx, "INSERT INTO page_views (ts, site_id, path, user_id)")
	if err != nil {
		return fmt.Errorf("prepare page_views batch: %w", err)
	}
	defer batch.Close() // releases the connection if Send is never reached (ch-close-batch)
	for i := range views {
		if err := batch.AppendStruct(&views[i]); err != nil {
			return fmt.Errorf("append page view %d: %w", i, err)
		}
	}
	if err := batch.Send(); err != nil {
		return fmt.Errorf("send %d page views: %w", len(views), err)
	}
	return nil
}
```

- One `InsertPageViews` call is one insert and one new part: call it with thousands of rows, not one (`ch-batch-inserts`, `insert-batch-size`). A service that receives rows one at a time puts them through a **buffered writer** (bounded channel, flush at N rows or T seconds, flush on shutdown, retry with the same batch): [references/inserts.md](references/inserts.md).
- `Append(v...)` in column order is faster than `AppendStruct`, which reflects; for the hottest paths, append whole columns with `batch.Column(i).Append(slice)`.
- **Async inserts** when many producers send small inserts that can't be batched in one place: `clickhouse.Context(ctx, clickhouse.WithAsync(true))` on an `Exec` or a batch, which sets `async_insert=1, wait_for_async_insert=1` (`ch-async-insert-wait`, `insert-async-small-batches`).
- **Retries** resend the identical batch, which ClickHouse deduplicates on replicated tables (and on `MergeTree` with `non_replicated_deduplication_window`), plus `insert_deduplication_token` when the source has a natural key (`ch-idempotent-retries`).
- **Changing or removing rows:** insert a new version into a `ReplacingMergeTree`, or a sign row into a `CollapsingMergeTree`; old data leaves through a TTL or `DROP PARTITION` (`insert-mutation-avoid-update`, `insert-mutation-avoid-delete`, `ch-no-mutations`).

## 4. Schema changes, observability, tests

- **Migrations** with the project's tool; for golang-migrate, the `clickhouse://…?x-multi-statement=true&x-migrations-table-engine=MergeTree` driver (and `x-cluster-name` on a cluster, with replicated engines written in the migrations themselves). One statement per migration where possible: ClickHouse DDL isn't transactional, so a half-applied multi-statement migration is fixed by hand. The ORDER BY can't change later without a new table (`schema-pk-plan-before-creation`).
- **Observability:** a span around each store call, its context passed to the server with `clickhouse.WithSpan(span.SpanContext())`; a `WithQueryID` or `log_comment` setting to find the query in `system.query_log`; pool gauges from `conn.Stats()`; writer metrics (rows buffered, flushed, dropped, flush duration, failures). [references/operations.md](references/operations.md).
- **Tests:** a real ClickHouse, one database per test, migrations applied: [references/testing.md](references/testing.md).

## References

- [references/inserts.md](references/inserts.md): the buffered writer, batch sizing, async inserts, retries and deduplication, columnar appends, long-lived batches
- [references/queries.md](references/queries.md): parameters in depth, scanning, type mapping (DateTime64 and time zones, Nullable, LowCardinality, Decimal, UUID, Map, Array, Tuple), FINAL and its alternatives, errors
- [references/operations.md](references/operations.md): options in depth, TLS and several hosts, logging, metrics and tracing, migrations, ch-go
- [references/testing.md](references/testing.md): a real ClickHouse per test package, a database per test, what to test
- [clickhouse-best-practices](../clickhouse-best-practices/SKILL.md): schema, query and insert design rules (vendored, ClickHouse Inc)
- Upstream docs: [Go client](https://clickhouse.com/docs/integrations/go), [clickhouse-go](https://github.com/ClickHouse/clickhouse-go) and its `examples/clickhouse_api`, [insert strategy](https://clickhouse.com/docs/best-practices/selecting-an-insert-strategy), [async inserts](https://clickhouse.com/docs/optimize/asynchronous-inserts), [ch-go](https://github.com/ClickHouse/ch-go)
