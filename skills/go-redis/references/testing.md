# Testing code that uses Redis

The team skill wins; this is the detail behind its section 6. General test style is [go-testing](../../go-testing/SKILL.md); the "no mocked database" decision is `test-real-database`.

## What is tested where

| Code | Test against |
|---|---|
| The Redis adapter (cache, lock, rate limiter, stream consumer, key functions) | A real Redis, through a `redistest` helper |
| A domain service that uses a cache or a lock | A hand-written fake of the small interface the service declares (`CustomerCache`, `Locker`), no Redis |
| The service end to end | The real stack the project's integration tests start (compose, CI services) |

No command-level mocks (`redismock` expectations on command text): they pass while the real command has the wrong arguments, the wrong type or a missing TTL. `miniredis` is not adopted for new code: it is a reimplementation that differs from the server in Lua, streams, cluster behaviour and newer commands. A project that already uses it keeps it for what it covers, and tests scripts, streams and cluster code against a real server.

## The helper

One Redis per test package, and a key prefix per test, so tests can run with `t.Parallel()` and never see each other's keys. The adapter takes the prefix as its `key_prefix` setting.

```go
// Package redistest gives each test a real Redis and its own key prefix.
package redistest

import (
	"context"
	"crypto/rand"
	"os"
	"sync"
	"testing"

	"github.com/redis/go-redis/v9"
	tcredis "github.com/testcontainers/testcontainers-go/modules/redis"
)

var (
	once    sync.Once
	url     string
	initErr error
)

// Open returns a client to a real Redis and a key prefix unique to the test.
// REDIS_URL (a CI service) wins; otherwise one container is started for the package's tests.
func Open(t *testing.T) (*redis.Client, string) {
	t.Helper()
	once.Do(func() {
		if u := os.Getenv("REDIS_URL"); u != "" {
			url = u
			return
		}
		c, err := tcredis.Run(context.Background(), "redis:8-alpine")
		if err != nil {
			initErr = err
			return
		}
		// Left running for the package; testcontainers' reaper removes it when the test binary exits.
		url, initErr = c.ConnectionString(context.Background())
	})
	if initErr != nil {
		t.Fatalf("redis for tests: %v", initErr)
	}
	opts, err := redis.ParseURL(url)
	if err != nil {
		t.Fatalf("parse REDIS_URL: %v", err)
	}
	opts.ContextTimeoutEnabled = true
	rdb := redis.NewClient(opts)
	prefix := "test:" + rand.Text()[:10] + ":"
	t.Cleanup(func() {
		ctx := context.Background()
		iter := rdb.Scan(ctx, 0, prefix+"*", 500).Iterator()
		for iter.Next(ctx) {
			rdb.Unlink(ctx, iter.Val())
		}
		_ = rdb.Close()
	})
	return rdb, prefix
}
```

- Pin the image to the major version production runs (`redis:8-alpine`, or a `valkey/valkey` image when production is Valkey).
- In CI, a Redis service container and `REDIS_URL=redis://redis:6379/0` avoid starting Docker from the tests; locally the container starts on its own. Projects that already standardise on one of the two keep it.
- Never `FLUSHALL` or `FLUSHDB` in a helper: parallel tests and other packages share the server. Clean up by prefix.
- Cluster-only behaviour (hash tags, `CROSSSLOT`) needs a cluster: a six-node cluster image or the project's compose file, in a separate, slower test target.

## What to assert

- **A miss and a hit:** the first `Get` loads from the fake store and fills the key; the second doesn't call the store.
- **The TTL:** `rdb.TTL(ctx, key)` is positive and within the jitter range, not `-1` (no expiry).
- **The value's shape:** decode the raw value, so a change of encoding is a visible, deliberate test change.
- **Redis down:** a client pointed at a closed port (`127.0.0.1:1`) with short timeouts; the cache path still answers from the store and logs a warning (zap's `zaptest/observer`).
- **Locks:** a second `Acquire` fails while the first is held; `Release` with the wrong token leaves the key; the lock is free after its TTL (use a short TTL, not a sleep of seconds).
- **Atomic updates:** run the read-modify-write from many goroutines and assert the final value (`-race` on).
- **Streams:** an entry handled and acknowledged; a handler error leaves it pending (`XPending`); a second consumer reclaims it after `MinIdle` (set it to milliseconds in the test).

Time-based behaviour on a real server can't be faked: use TTLs and idle times of tens of milliseconds and poll with a deadline, never fixed long sleeps.
