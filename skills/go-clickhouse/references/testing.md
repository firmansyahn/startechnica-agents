# Testing ClickHouse code

Store code is tested against a real ClickHouse, as PostgreSQL code is (`test-real-database` in [go-testing](../../go-testing/SKILL.md), decision 2 of [go-database](../../go-database/SKILL.md)). A mock of `driver.Conn` passes while the real query has a wrong column, a type the driver refuses (`count()` into `int`), or an engine that never deduplicates.

## One server per package, one database per test

Start one ClickHouse per test package (a container is slow to start; a database is cheap), and give each test its own database with the migrations applied.

```go
package chstore_test

var testAddr string // host:port of the native protocol

func TestMain(m *testing.M) {
	os.Exit(runTests(m))
}

func runTests(m *testing.M) int {
	if addr := os.Getenv("CLICKHOUSE_TEST_ADDR"); addr != "" { // a server the CI job provides
		testAddr = addr
		return m.Run()
	}
	ctx := context.Background()
	ctr, err := tcclickhouse.Run(ctx, "clickhouse/clickhouse-server:<version>", // pin the version production runs
		tcclickhouse.WithUsername("test"), tcclickhouse.WithPassword("test"))
	if err != nil {
		fmt.Fprintln(os.Stderr, "start clickhouse:", err)
		return 1
	}
	defer func() { _ = testcontainers.TerminateContainer(ctr) }()
	if testAddr, err = ctr.ConnectionHost(ctx); err != nil {
		fmt.Fprintln(os.Stderr, "clickhouse address:", err)
		return 1
	}
	return m.Run()
}

// openTestDB creates a fresh database, applies the migrations to it and drops it after the test.
func openTestDB(t *testing.T) driver.Conn {
	t.Helper()
	ctx := t.Context()
	name := fmt.Sprintf("test_%d", time.Now().UnixNano())
	admin := mustOpen(t, "default")
	if err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil { // a generated name, not input
		t.Fatalf("create database: %v", err)
	}
	t.Cleanup(func() { _ = admin.Exec(context.Background(), "DROP DATABASE IF EXISTS "+name) })
	migrateUp(t, testAddr, name) // the same migrations production runs
	return mustOpen(t, name)
}

func mustOpen(t *testing.T, database string) driver.Conn {
	t.Helper()
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{testAddr},
		Auth: clickhouse.Auth{Database: database, Username: "test", Password: "test"},
	})
	if err != nil {
		t.Fatalf("open clickhouse: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}
```

`tcclickhouse` is `github.com/testcontainers/testcontainers-go/modules/clickhouse`; in a project that already uses testcontainers, use its helpers the same way. Without Docker (a developer laptop without it, a restricted runner), point `CLICKHOUSE_TEST_ADDR` at a local server, or skip with a clear message when neither is available: never pass silently.

## What to test

- **Inserts round-trip:** insert a batch through the store, read it back through the store's query, compare every field, including times (zone and precision) and `Nullable` columns.
- **Retries don't duplicate:** insert the same batch twice with the same `insert_deduplication_token` and assert one copy; this catches a table that lacks `non_replicated_deduplication_window` or a replicated engine.
- **Deduplicated reads:** insert two versions of one row into a `ReplacingMergeTree` and assert the query returns the latest one without waiting for a merge (it must use `FINAL` or `argMax`).
- **The writer:** with a fake store (the writer depends on an interface), assert it flushes at `MaxRows`, at `MaxAge` (with a short age, waiting on a channel, never `time.Sleep`: `test-no-sleep`), on `Close`, and that `Add` refuses when the queue is full.
- **Errors:** a query against a missing table maps to the store's error; a cancelled context returns promptly.
- **Parallel tests** are fine with a database per test (`t.Parallel()`); tests that share one database don't call it (`test-race-and-parallel`).

Inserted data is visible to the next query as soon as a synchronous insert returns, so no waiting is needed; async inserts with `wait_for_async_insert=1` behave the same.
