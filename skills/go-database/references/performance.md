# Database Performance

## Table of Contents

- [Connection Pool Sizing](#connection-pool-sizing)
  - [Configuration](#configuration)
  - [Monitoring](#monitoring)
  - [Prometheus Metrics](#prometheus-metrics)
- [Batch Processing](#batch-processing)
  - [Sweet spot: 100–1,000 rows per batch](#sweet-spot-1001000-rows-per-batch)
  - [Batch INSERT with `pgx.Batch`](#batch-insert-with-pgxbatch)
  - [Bulk INSERT with pgx (PostgreSQL COPY protocol)](#bulk-insert-with-pgx-postgresql-copy-protocol)
  - [Cursor-based pagination (avoid OFFSET)](#cursor-based-pagination-avoid-offset)
- [Indexing Strategy](#indexing-strategy)
  - [Use SQL MCP to check existing indexes](#use-sql-mcp-to-check-existing-indexes)
  - [When to suggest adding indexes](#when-to-suggest-adding-indexes)
  - [When to suggest removing indexes](#when-to-suggest-removing-indexes)
- [Query Performance Tips](#query-performance-tips)

## Connection Pool Sizing

### Configuration

```go
cfg, err := pgxpool.ParseConfig(dsn)
if err != nil {
    return fmt.Errorf("parsing database config: %w", err)
}

cfg.MaxConns = 25                       // total connections (match your DB capacity)
cfg.MinConns = 2                        // keep connections warm, reduce handshake overhead
cfg.MaxConnLifetime = 5 * time.Minute   // recycle connections (DNS changes, server restarts)
cfg.MaxConnIdleTime = 1 * time.Minute   // release idle connections

pool, err := pgxpool.NewWithConfig(ctx, cfg)
if err != nil {
    return fmt.Errorf("connecting to database: %w", err)
}
```

The same settings can come from the DSN (`pool_max_conns`, `pool_min_conns`, `pool_max_conn_lifetime`, `pool_max_conn_idle_time`).

| Setting | Too low | Too high |
| --- | --- | --- |
| `MaxConns` | Requests queue waiting for conn | DB overwhelmed, context switches |
| `MinConns` | Cold connections, slow queries | Wasted server memory holding idle conns |
| `MaxConnLifetime` | Frequent reconnection overhead | Stale connections after failover |
| `MaxConnIdleTime` | Frequent reconnection after quiet spells | Idle conns consume server memory |

### Monitoring

Check pool stats in production to detect exhaustion:

```go
stats := pool.Stat()
log.Info("db pool",
    zap.Int32("open", stats.TotalConns()),
    zap.Int32("in_use", stats.AcquiredConns()),
    zap.Int32("idle", stats.IdleConns()),
    zap.Int64("empty_acquire_count", stats.EmptyAcquireCount()), // acquires that had to wait for a connection
    zap.Duration("acquire_duration", stats.AcquireDuration()),   // total time spent acquiring
)
```

If `EmptyAcquireCount` keeps climbing, increase `MaxConns` or optimize slow queries.

### Prometheus Metrics

Use a custom Prometheus collector to export pool metrics on-demand (scales to multiple pools automatically):

```go
type DBCollector struct {
    pools map[string]*pgxpool.Pool
}

func NewDBCollector(pools map[string]*pgxpool.Pool) *DBCollector {
    return &DBCollector{pools: pools}
}

func (c *DBCollector) Describe(ch chan<- *prometheus.Desc) {
    ch <- prometheus.NewDesc("db_open_connections", "Number of open connections", []string{"pool"}, nil)
    ch <- prometheus.NewDesc("db_in_use_connections", "Connections currently in use", []string{"pool"}, nil)
    ch <- prometheus.NewDesc("db_idle_connections", "Idle connections in pool", []string{"pool"}, nil)
    ch <- prometheus.NewDesc("db_empty_acquire_total", "Acquires that waited for a connection", []string{"pool"}, nil)
    ch <- prometheus.NewDesc("db_acquire_duration_seconds_total", "Total time spent acquiring connections", []string{"pool"}, nil)
}

func (c *DBCollector) Collect(ch chan<- prometheus.Metric) {
    for poolName, pool := range c.pools {
        stats := pool.Stat()

        ch <- prometheus.MustNewConstMetric(
            prometheus.NewDesc("db_open_connections", "Number of open connections", []string{"pool"}, nil),
            prometheus.GaugeValue, float64(stats.TotalConns()), poolName)

        ch <- prometheus.MustNewConstMetric(
            prometheus.NewDesc("db_in_use_connections", "Connections currently in use", []string{"pool"}, nil),
            prometheus.GaugeValue, float64(stats.AcquiredConns()), poolName)

        ch <- prometheus.MustNewConstMetric(
            prometheus.NewDesc("db_idle_connections", "Idle connections in pool", []string{"pool"}, nil),
            prometheus.GaugeValue, float64(stats.IdleConns()), poolName)

        ch <- prometheus.MustNewConstMetric(
            prometheus.NewDesc("db_empty_acquire_total", "Acquires that waited for a connection", []string{"pool"}, nil),
            prometheus.CounterValue, float64(stats.EmptyAcquireCount()), poolName)

        ch <- prometheus.MustNewConstMetric(
            prometheus.NewDesc("db_acquire_duration_seconds_total", "Total time spent acquiring connections", []string{"pool"}, nil),
            prometheus.CounterValue, stats.AcquireDuration().Seconds(), poolName)
    }
}

func init() {
    pools := map[string]*pgxpool.Pool{
        "primary": mainDB,
        "replica": replicaDB,
    }
    prometheus.MustRegister(NewDBCollector(pools))
}
```

**Collector advantages:**

- Metrics are collected on-demand during scrapes (no background goroutine)
- Always returns current state (no stale data between scrapes)
- Scales to multiple pools automatically
- Lower memory footprint (no metric state in memory)

**Alert thresholds:**

- Open connections approaching `MaxConns` → risk of request queuing
- Empty-acquire count climbing steadily → pool is exhausted, increase `MaxConns`
- Idle connections too high → lower `MinConns` or `MaxConnIdleTime`

## Batch Processing

Avoid two extremes:

- **Row-by-row** — N round trips for N rows, extremely slow
- **One giant batch** — locks tables, consumes memory, can timeout and block other queries

### Sweet spot: 100–1,000 rows per batch

Adjust based on row size and database load. Larger rows → smaller batches.

### Batch INSERT with `pgx.Batch`

`pgx.Batch` queues statements and sends them in one round trip; `Close` on the results reads every reply and returns the first error:

```go
func insertUsersBatch(ctx context.Context, pool *pgxpool.Pool, users []User) error {
    const batchSize = 500
    for i := 0; i < len(users); i += batchSize {
        end := min(i+batchSize, len(users))

        batch := &pgx.Batch{}
        for _, u := range users[i:end] {
            batch.Queue(`INSERT INTO users (name, email) VALUES ($1, $2)`, u.Name, u.Email)
        }
        if err := pool.SendBatch(ctx, batch).Close(); err != nil {
            return fmt.Errorf("inserting users batch %d-%d: %w", i, end, err)
        }
    }
    return nil
}
```

A single multi-row statement is the other option: pass each column as an array and expand it with `unnest` (`INSERT INTO users (name, email) SELECT * FROM unnest($1::text[], $2::text[])`).

### Bulk INSERT with pgx (PostgreSQL COPY protocol)

For maximum throughput on PostgreSQL, use `pgx.CopyFrom` which uses the binary COPY protocol — significantly faster than multi-row INSERT:

```go
rows := make([][]any, len(users))
for i, u := range users {
    rows[i] = []any{u.Name, u.Email}
}
_, err := pool.CopyFrom(ctx,
    pgx.Identifier{"users"},
    []string{"name", "email"},
    pgx.CopyFromRows(rows),
)
```

### Cursor-based pagination (avoid OFFSET)

For reading large datasets, use cursor-based pagination instead of `OFFSET`. OFFSET re-scans skipped rows, getting slower as you paginate deeper:

```go
// ✗ Bad — OFFSET re-scans rows, O(offset + limit)
SELECT * FROM events ORDER BY created_at LIMIT 100 OFFSET 10000

// ✓ Good — cursor-based, O(limit) regardless of depth
SELECT * FROM events WHERE created_at > $1 ORDER BY created_at LIMIT 100
```

## Indexing Strategy

**Never create or drop indexes yourself.** Index changes affect production query performance and write throughput. Always suggest to the developer and let them decide.

### Use SQL MCP to check existing indexes

When a SQL MCP tool is available, query the database to check existing indexes before suggesting new ones:

```sql
-- PostgreSQL: list indexes on a table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users';

-- Check for unused indexes (low scan count relative to writes)
SELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan < 10
ORDER BY idx_scan;
```

### When to suggest adding indexes

- Foreign key columns (PostgreSQL does NOT auto-index foreign keys)
- Columns frequently used in `WHERE`, `JOIN`, or `ORDER BY`
- Composite indexes for multi-column queries (leftmost column is most selective)
- Partial indexes for filtered queries (`WHERE active = true`)

### When to suggest removing indexes

- Indexes with near-zero `idx_scan` count (nobody reads them)
- Duplicate indexes (same columns in same order)
- Indexes on write-heavy tables that slow down INSERT/UPDATE/DELETE
- Wide composite indexes where a narrower one would suffice

Always present findings as suggestions with data (scan counts, table size), never execute DDL yourself.

## Query Performance Tips

- **`EXPLAIN ANALYZE`** before optimizing — measure, don't guess
- **List columns explicitly** — avoid `SELECT *`, it fetches unnecessary data and breaks struct scanning when schema changes
- **Use `LIMIT`** for pagination, always with an `ORDER BY`
- **Prefer `EXISTS` over `COUNT`** for existence checks — `EXISTS` stops at the first match
- **Avoid N+1 queries** — use `JOIN` or batch `WHERE id = ANY($1)` instead of querying in a loop
- **Suggest improvements, never execute them** — performance changes (indexes, query rewrites, configuration) need human review in context of production data and workload patterns

**Rules:**

- Batch operations SHOULD use 100–1,000 rows per batch — adjust based on row size and database load.
- Cursor-based pagination MUST replace `OFFSET` for large datasets — the cursor column MUST be chosen based on actual indexes (e.g., `created_at`, `user_id`).
- NEVER create indexes blindly — check existing indexes, measure with `EXPLAIN ANALYZE`, and present findings as suggestions.
- N+1 queries MUST be eliminated — use `JOIN` or batch `WHERE id = ANY($1)`.

→ See `go-observability` skill for database metrics and query monitoring. Pool metrics (`db_open_connections`, `db_in_use_connections`, `db_idle_connections`) can be queried from the command line with a PromQL client.
