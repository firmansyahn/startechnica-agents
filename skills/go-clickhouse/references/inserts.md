# Inserts

How a Go service gets rows into ClickHouse: batch size, the buffered writer, async inserts, retries and deduplication. The rules are `ch-batch-inserts`, `ch-close-batch`, `ch-async-insert-wait`, `ch-idempotent-retries` and `ch-no-mutations` ([../SKILL.md](../SKILL.md)); the server-side reasoning is the `insert-*` rules of [clickhouse-best-practices](../../clickhouse-best-practices/SKILL.md).

## Why batches

Every synchronous INSERT into a MergeTree table writes at least one new part (more if the rows span partitions). Background merges combine parts; when inserts create parts faster than merges remove them, the server first slows inserts (`parts_to_delay_insert`) and then refuses them with exception 252, "too many parts". The targets from ClickHouse's insert guidance:

| | Value |
|---|---|
| Rows per INSERT | at least 1,000; 10,000 to 100,000 is the target |
| INSERTs per table | about one per second (synchronous) |
| Partitions touched by one INSERT | as few as possible: one, ideally |
| Format | Native (what clickhouse-go sends) |
| Compression | LZ4; ZSTD when bandwidth costs more than CPU |

Pre-sorting rows by the table's ORDER BY is optional; it helps when the data already arrives nearly in order.

## Choosing the insert path

| Situation | Path |
|---|---|
| A job or consumer that already holds thousands of rows | One `PrepareBatch` … `Send` per chunk |
| A service receiving rows one at a time (HTTP events, a queue consumer) | A buffered writer in the service (below) |
| Many processes each sending a few rows, no shared place to batch | Async inserts with `WithAsync(true)` (waits for the flush) |
| Copying or transforming data already in ClickHouse | `INSERT INTO … SELECT` on the server, one `Exec` |
| Millions of rows per second where profiling shows the client is the limit | `ch-go` columnar inserts ([operations.md](operations.md)) |

## A batch, the fast way

```go
batch, err := s.conn.PrepareBatch(ctx, "INSERT INTO page_views (ts, site_id, path, user_id)")
if err != nil {
	return fmt.Errorf("prepare page_views batch: %w", err)
}
defer batch.Close()
for i := range views {
	v := &views[i]
	if err := batch.Append(v.TS, v.SiteID, v.Path, v.UserID); err != nil { // column order of the INSERT
		return fmt.Errorf("append page view %d: %w", i, err)
	}
}
if err := batch.Send(); err != nil {
	return fmt.Errorf("send %d page views: %w", len(views), err)
}
```

- **Name the columns** in the INSERT: a column added to the table later then takes its default instead of shifting the values. Columns left out take their `DEFAULT`.
- `Append` takes the values in column order; `AppendStruct(&v)` maps by `ch` tag and costs reflection per row; columnar `batch.Column(i).Append(slice)` appends a whole column at once and is the fastest of the three.
- **Exact types:** append the Go type of the column (`uint32` for `UInt32`, `time.Time` for `DateTime64`, `uuid.UUID` for `UUID`); the driver refuses a mismatch instead of converting silently, and conversions from strings (a UUID or IP as text) cost validation on every row.
- **`Flush()`** (native protocol only) sends the rows appended so far as a block and keeps the batch open: use it for very large batches to bound client memory. The whole batch is still one INSERT.
- **`driver.WithReleaseConnection()`** on `PrepareBatch` returns the connection to the pool between `Flush`es, for a long-lived batch that is filled slowly. A buffered writer that builds a fresh batch per flush doesn't need it.

## The buffered writer

A service that receives one event per request collects them and inserts in batches. The writer is a goroutine with an owner ([go-concurrency](../../go-concurrency/SKILL.md), `conc-goroutine-owner`): it flushes when the buffer reaches `MaxRows`, when the oldest row is `MaxAge` old, and when it is closed.

```go
type WriterConfig struct {
	MaxRows      int           // flush at this many rows (default 50_000)
	MaxAge       time.Duration // flush at least this often (default 2s)
	QueueSize    int           // rows waiting for the writer; Add fails when full (default 4 * MaxRows)
	FlushTimeout time.Duration // per flush, retries included (default 30s)
}

type PageViewWriter struct {
	in    chan PageView
	done  chan struct{}
	store *Store
	log   *zap.Logger
	cfg   WriterConfig
}

var ErrWriterFull = errors.New("page view writer full")

func NewPageViewWriter(store *Store, log *zap.Logger, cfg WriterConfig) *PageViewWriter {
	// ... fill cfg defaults
	w := &PageViewWriter{in: make(chan PageView, cfg.QueueSize), done: make(chan struct{}), store: store, log: log, cfg: cfg}
	go w.run()
	return w
}

// Add queues one row. It never blocks the request: when the queue is full it returns
// ErrWriterFull and the handler answers 503 so the client retries.
func (w *PageViewWriter) Add(ctx context.Context, v PageView) error {
	select {
	case w.in <- v:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		return ErrWriterFull
	}
}

// Close stops accepting rows, flushes what is queued and waits for the last flush.
// Call it on shutdown, before the connection is closed. No Add may run after Close.
func (w *PageViewWriter) Close() {
	close(w.in)
	<-w.done
}

func (w *PageViewWriter) run() {
	defer close(w.done)
	buf := make([]PageView, 0, w.cfg.MaxRows)
	ticker := time.NewTicker(w.cfg.MaxAge)
	defer ticker.Stop()
	flush := func() {
		if len(buf) == 0 {
			return
		}
		w.flush(buf) // a fixed batch: retries resend exactly these rows
		buf = make([]PageView, 0, w.cfg.MaxRows)
	}
	for {
		select {
		case v, ok := <-w.in:
			if !ok {
				flush()
				return
			}
			buf = append(buf, v)
			if len(buf) >= w.cfg.MaxRows {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func (w *PageViewWriter) flush(rows []PageView) {
	ctx, cancel := context.WithTimeout(context.Background(), w.cfg.FlushTimeout) // the writer's own lifetime, not a request's
	defer cancel()
	start := time.Now()
	err := retryTransient(ctx, func() error { return w.store.InsertPageViews(ctx, rows) })
	if err != nil {
		w.log.Error("flush page views", zap.Int("rows", len(rows)), zap.Error(err))
		// count the dropped rows in a metric; or hand them to a dead-letter path
		return
	}
	w.log.Debug("flushed page views", zap.Int("rows", len(rows)), zap.Duration("took", time.Since(start)))
}
```

- **Memory is bounded** by `QueueSize + MaxRows` rows; `Add` refuses instead of growing a buffer without limit.
- **Shutdown order:** stop the HTTP server (no more `Add`), `writer.Close()` (last flush), then `conn.Close()`. Rows still in memory when the process is killed are lost: when the source can resend (a queue), commit its offsets only after the flush that contains them succeeded, and the writer becomes at-least-once.
- **One writer per table** per process; several replicas of the service each flush about once per `MaxAge`, so set `MaxAge` so that `replicas / MaxAge` stays near one insert per second per table, or use async inserts in addition.
- **Metrics:** rows queued, rows flushed, rows dropped, flush duration and failures ([operations.md](operations.md)).

## Async inserts

The server buffers small INSERTs from many clients and writes them as one part, flushing at `async_insert_max_data_size` (100 MiB by default), `async_insert_busy_timeout_ms` (200 ms by default, adaptive since 24.2) or `async_insert_max_query_number` (450), whichever comes first.

```go
ctx = clickhouse.Context(ctx, clickhouse.WithAsync(true)) // wait for the flush
err := s.conn.Exec(ctx, "INSERT INTO page_views (ts, site_id, path) VALUES (?, ?, ?)", ts, siteID, path)
```

- `WithAsync(true)` sets `async_insert=1, wait_for_async_insert=1` for `Exec` and for a batch from `PrepareBatch` on that context. `WithAsync(false)` is fire-and-forget and isn't used (`ch-async-insert-wait`).
- Waiting costs latency (up to the busy timeout) but not throughput; a client that sends many rows still batches them, because each async INSERT is still parsed on its own.
- If any row of one INSERT fails parsing or type checks, that INSERT's data is rejected; the others in the same flush are not affected.
- The settings can live in the ClickHouse user's profile instead (`ALTER USER … SETTINGS async_insert = 1, wait_for_async_insert = 1`); keep them in one place.

## Retries and deduplication

An INSERT that returned an error, or never returned, may or may not have been written. ClickHouse makes a retry safe when the retried block is identical:

- **Replicated tables** (`ReplicatedMergeTree` and its variants) keep a log of recent block hashes (`replicated_deduplication_window`) and drop a repeated block.
- **Plain `MergeTree`** deduplicates only when the table sets `non_replicated_deduplication_window` to a positive number; set it in the migration for tables that receive retried inserts.
- **Async inserts** are deduplicated per INSERT query, since 26.2 by default (`deduplicate_insert`); a duplicate query doesn't discard others flushed with it.
- **`insert_deduplication_token`** replaces the content hash with a key you give, so a retry that rebuilt the batch (after a restart, say) is still recognised. Derive it from the source: a queue partition and offset range, a job ID and chunk number. Never a random value, which defeats it.

```go
ctx = clickhouse.Context(ctx, clickhouse.WithSettings(clickhouse.Settings{
	"insert_deduplication_token": fmt.Sprintf("orders:%s:%d", jobID, chunk),
}))
```

- **Retry only transient errors**, with backoff and a cap: network errors, `context.DeadlineExceeded` of one attempt (not of the caller), and exceptions 252 (too many parts), 202 (too many simultaneous queries), 159 (timeout). An exception about a type, a column or parsing fails the same way again: log it and drop or dead-letter the batch.
- **Readers that can't tolerate a duplicate** that slipped past deduplication (two producers sent the same event) read from a `ReplacingMergeTree` keyed by the event ID, with `FINAL` or `argMax` ([queries.md](queries.md)).

## Updates and deletes

Covered by `ch-no-mutations` and upstream's `insert-mutation-avoid-update` and `insert-mutation-avoid-delete`. In short: new versions into a `ReplacingMergeTree(version)` or sign rows into a `CollapsingMergeTree`, a `TTL` for retention, `ALTER TABLE … DROP PARTITION` for bulk removal by an operator, lightweight `DELETE FROM` only for rare corrections run outside the request path.
