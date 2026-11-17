# Testing MongoDB code

Read with [SKILL.md](../SKILL.md) and `go-testing` (`test-real-database`) when writing a store test or the helper behind it.

## Decisions

- **A real MongoDB, no mocked driver.** Store code is tested against a real server: a mocked `Collection` passes while the real filter has a wrong key, a missing index or an operator the server rejects. The driver's `mtest` package is internal in v2 and not for applications; interface fakes of the store are for testing the services above it, not the store.
- **A single-node replica set**, so transactions and change streams work as in production.
- **Authorization on**, with a test user in the URI, so the store logs in as it does in production; a CI server from `MONGODB_TEST_URI` carries credentials too. A test of `ClientOptions` (no server needed) covers the refusals: an anonymous URI, PLAIN without TLS, credentials in both places.
- **One database per test**, named from random bytes and dropped in cleanup, so tests can run with `t.Parallel()` against one server.
- **The same `EnsureIndexes`** the service runs, so unique indexes and query plans are tested too.

## The helper

The project's own test helper wins where it exists (a `mongotest` package next to `dbtest`). Where none exists, one server per test package started with testcontainers-go's MongoDB module, or a server from an env var in CI:

```go
// internal/platform/mongostore/mongotest/mongotest.go
package mongotest

var (
	once sync.Once
	uri  string
	err  error
)

// URI returns a MongoDB connection string: MONGODB_TEST_URI when set (CI service), otherwise a
// single-node replica set started once per test binary with testcontainers.
func URI(t *testing.T) string {
	t.Helper()
	if v := os.Getenv("MONGODB_TEST_URI"); v != "" {
		return v
	}
	once.Do(func() {
		var ctr *mongodb.MongoDBContainer
		// Authorization on, as in production (mongo-authenticated-connection): the module creates
		// the root user, sets up the replica set's key file, and puts the login in the URI.
		ctr, err = mongodb.Run(context.Background(), "mongo:8.0",
			mongodb.WithReplicaSet("rs0"),
			mongodb.WithUsername("orders-test"),
			mongodb.WithPassword("test-secret"),
		)
		if err == nil {
			uri, err = ctr.ConnectionString(context.Background())
		}
		// the container is reaped when the test binary exits (testcontainers' Ryuk)
	})
	if err != nil {
		t.Fatalf("start mongodb: %v", err)
	}
	return uri
}

// Open returns a store on a fresh database with its indexes, dropped when the test ends.
func Open(t *testing.T) *mongostore.Store {
	t.Helper()
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	cfg := mongostore.Defaults()
	cfg.URI = URI(t) // holds the test user's login
	cfg.AppName = "orders-test"
	cfg.Database = "test_" + hex.EncodeToString(b)

	ctx := t.Context()
	s, err := mongostore.Open(ctx, cfg)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = s.DropDatabase(ctx)
		_ = s.Close(ctx)
	})
	if err := s.EnsureIndexes(ctx); err != nil {
		t.Fatalf("ensure indexes: %v", err)
	}
	return s
}
```

Pin the image to the major version production runs (`mongo:8.0`, not `latest`). In GitLab CI, a `services:` entry for MongoDB started as a replica set, or a Docker-in-Docker runner for testcontainers, provides the server (`gitlab-ci`).

## What to test

- Each store method: the happy path, not found (`ErrNotFound`), a duplicate key (`ErrConflict`), and the tenant boundary (another tenant's document is not found).
- Soft deletes: a deleted document is absent from every read.
- Pagination: pages don't overlap or skip when documents are inserted between pages.
- Indexes: the main queries use their index. `explain` returns the winning plan:

```go
var plan bson.M
err := s.DB().RunCommand(ctx, bson.D{
	{Key: "explain", Value: bson.D{{Key: "find", Value: "customers"}, {Key: "filter", Value: filter}}},
	{Key: "verbosity", Value: "queryPlanner"},
}).Decode(&plan)
// assert the winning plan contains an IXSCAN on the expected index name, not a COLLSCAN
```

- Transactions: a failure in the second write leaves the first unapplied.
- Times: compare with `Truncate(time.Millisecond)` and in UTC.

No `time.Sleep` to wait for writes (`test-no-sleep`): with majority writes on a single-node replica set, a write is visible to the next read on the same client.
