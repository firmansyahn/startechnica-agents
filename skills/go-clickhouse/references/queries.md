# Queries

Parameters, scanning, Go types for ClickHouse types, deduplicated reads and errors. Rules: `ch-bind-parameters`, `ch-context-deadline`, `ch-close-rows` ([../SKILL.md](../SKILL.md)); query design is the `query-*` and `schema-pk-*` rules of [clickhouse-best-practices](../../clickhouse-best-practices/SKILL.md).

## Parameters

Three ways to bind a value; never `fmt.Sprintf` (`ch-bind-parameters`).

| Style | In the query | Arguments | Bound by |
|---|---|---|---|
| Positional | `WHERE site_id = ? AND ts >= ?` | `siteID, from` | the driver, as escaped literals |
| Named, client-side | `WHERE site_id = @site` | `clickhouse.Named("site", siteID)` | the driver, as escaped literals |
| Server-side | `WHERE site_id = {site:UInt32}` | `clickhouse.Named("site", siteID)`, or `clickhouse.WithParameters(clickhouse.Parameters{"site": "42"})` on the context | the server, typed and checked (server 22.8+) |

- One query uses one style; don't mix `?` with `@name`.
- **Identifiers** (a table or column chosen at run time): `{col:Identifier}` server-side, or an allow-list mapping the caller's word to a known column. Never a value from input in the SQL text.
- **Times:** `Named` keeps the moment a `time.Time` points to, whatever its zone. As a server-side parameter it keeps sub-second precision when the value has any, which a plain `{from:DateTime}` parameter rejects: use `clickhouse.DateNamed("from", t, clickhouse.Seconds)` there, and `clickhouse.MilliSeconds` for `DateTime64(3)`.
- **Lists:** `WHERE site_id IN (?)` with a slice argument (the driver writes it as an array literal); server-side, `has({ids:Array(UInt32)}, site_id)`. Tuples: `clickhouse.GroupSet`.
- `WithParameters` takes strings in ClickHouse's escaped text format (`"['a', 'b']"` for an array); `Named` with a Go value is easier to get right.

## Reading results

- `conn.Select(ctx, &[]T{}, q, args...)`: every row into a slice of structs, matched by `ch:"column"` tag (or field name), rows closed for you. The default for anything that fits in memory.
- `conn.QueryRow(ctx, q, args...).Scan(&a, &b)` or `.ScanStruct(&t)`: one row. No row is `sql.ErrNoRows`, as with `database/sql`.
- `conn.Query` with `rows.Next()` and `rows.Scan`/`ScanStruct`: to stream a large result without holding it all; `defer rows.Close()`, `rows.Err()` after the loop (`ch-close-rows`).
- **Big reads:** `clickhouse.WithBlockBufferSize(n)` on the context decodes more blocks in parallel at the cost of memory (the default, 2, is conservative). Better: aggregate on the server and return fewer rows.
- **Progress and cost:** `clickhouse.WithProgress(func(p *clickhouse.Progress) {...})` and `WithProfileInfo` report rows and bytes read, useful in a report job's logs.

## Types

The driver is strict: it scans and appends only the Go type that matches the column, and refuses the rest instead of converting.

| ClickHouse | Go | Notes |
|---|---|---|
| `UInt8` … `UInt64`, `Int8` … `Int64` | `uint8` … `uint64`, `int8` … `int64` | `count()`, `uniq()`, `sum()` of unsigned are `UInt64`: scan into `uint64` |
| `Float32`, `Float64` | `float32`, `float64` | Not for money |
| `Decimal(P, S)` | `decimal.Decimal` (`github.com/shopspring/decimal`) | Money and exact quantities |
| `String`, `LowCardinality(String)`, `FixedString(N)` | `string` (`[]byte` too) | `LowCardinality` for columns with fewer than ~10,000 distinct values (`schema-types-lowcardinality`) |
| `Enum8`, `Enum16` | `string` | A value outside the enum fails the insert (`schema-types-enum`) |
| `Bool` | `bool` | |
| `UUID` | `uuid.UUID` (`github.com/google/uuid`) | Not `String` (`schema-types-native-types`) |
| `Date`, `Date32` | `time.Time` | |
| `DateTime`, `DateTime64(P)` | `time.Time` | See time zones below |
| `Nullable(T)` | `*T` (or `sql.Null*`) | Costs an extra column per value; prefer a `DEFAULT` (`schema-types-avoid-nullable`) |
| `Array(T)` | `[]T` | |
| `Map(K, V)` | `map[K]V` | |
| `Tuple(...)` | a struct with `ch` tags, or `[]any` | Named tuples map to struct fields |
| `IPv4`, `IPv6` | `net.IP` / `netip.Addr` | |
| `JSON` | a struct, `map[string]any`, or `clickhouse.JSON`/`chcol` types | Only for genuinely dynamic shapes (`schema-json-when-to-use`) |

**Time zones:** a `DateTime` stores seconds since the epoch and a time zone for display. Declare columns as `DateTime64(3, 'UTC')` (or the precision you need), send `time.Time` values in UTC, and convert to a user's zone at the edge. A column without an explicit zone uses the server's zone, which then changes what `toDate(ts)` returns; reading back gives a `time.Time` in the column's zone (use `clickhouse.WithUserLocation` on the context only when a query needs another). Group by day in the user's zone on the server: `toDate(ts, {tz:String})`.

## Reading deduplicated tables

A `ReplacingMergeTree` keeps the latest version per ORDER BY key only after background merges, which happen at an unknown time; until then a plain `SELECT` sees several versions.

- **`FINAL`** (`SELECT … FROM orders FINAL WHERE …`) merges at read time: exact, slower, and much better on recent servers (parallel `FINAL`, `do_not_merge_across_partitions_select_final` when the partition key matches). Use it on queries that must be exact and filter to a small range.
- **`argMax`** aggregation: `SELECT order_id, argMax(status, version) AS status FROM orders WHERE customer_id = ? GROUP BY order_id`. Usually faster for wide scans.
- **Never `OPTIMIZE TABLE … FINAL`** to force merges from the service (`ch-no-mutations`, `insert-optimize-avoid-final`).

## Query shape

The server-side reasoning lives in clickhouse-best-practices; what it means for queries in a Go store:

- **Filter on the ORDER BY prefix** (`schema-pk-filter-on-orderby`): a store method's required arguments are the leading key columns (tenant or site, then time range).
- **Name the columns.** `SELECT *` reads every column from disk in a columnar store.
- **Always a `LIMIT`** on a query whose size a caller controls, and a time range on event tables.
- **Filter before joining**, and prefer dictionaries or denormalised columns to joins on hot paths (`query-join-filter-before`, `query-join-consider-alternatives`).
- **Aggregations that run on every request** belong in a materialized view maintained at insert time (`query-mv-incremental`), not a scan per request.
- **Limits per query** for anything user-facing: `clickhouse.WithSettings(clickhouse.Settings{"max_result_rows": 10000, "max_memory_usage": 2 << 30, "readonly": 1})`; the user's server profile is the better place for limits that always apply.

## Errors

```go
var exc *clickhouse.Exception
if errors.As(err, &exc) {
	switch exc.Code {
	case 60: // UNKNOWN_TABLE: a migration hasn't run
	case 159: // TIMEOUT_EXCEEDED
	case 241: // MEMORY_LIMIT_EXCEEDED: narrow the query
	case 252: // TOO_MANY_PARTS: inserts too small or too frequent; back off
	}
}
```

- Branch on `Code`, not on the message. `Name` is set; `CodeName` only over HTTP.
- `context.DeadlineExceeded` or `context.Canceled` comes back when the caller's context ended; return it wrapped, as for any query ([go-error-handling](../../go-error-handling/SKILL.md)).
- The store translates errors into the service's own (`ErrNotFound`, `ErrUnavailable`) so callers never import clickhouse-go.
