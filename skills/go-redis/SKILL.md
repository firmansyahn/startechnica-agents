---
name: go-redis
description: "Use when a Go service reads or writes Redis or Valkey: setting up, changing, reviewing or testing code on github.com/redis/go-redis/v9 — the one client per process (NewClient, NewClusterClient, NewFailoverClient, NewUniversalClient) and its redis settings block, pool size and timeouts, ContextTimeoutEnabled, TLS and ACL credentials, redis.Nil as a cache miss, key naming and prefixes, cluster hash tags and CROSSSLOT, TTLs and big keys, SCAN instead of KEYS, pipelines, WATCH/MULTI and Lua scripts (EVALSHA), cache-aside with singleflight and jittered TTLs, invalidation after commit, distributed locks with a token, rate limiting, Streams with consumer groups (XREADGROUP, XACK, XAUTOCLAIM) versus Pub/Sub, JSON or msgpack values, OpenTelemetry with redisotel, and tests against a real Redis with testcontainers. Also when choosing between go-redis and rueidis. Holds the redis-* rules; names the vendored redis-security and redis-observability skills for the server side."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects that use Redis or a Redis-compatible server through go-redis v9.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Redis from Go (team)

**Principle:** Redis holds copies and coordination state that can vanish at any moment: every key has an owner, a prefix and an expiry, every command runs under the caller's deadline, and the service stays correct when Redis is slow, empty or gone.

The team's pattern for Redis (and Valkey or a managed Redis-compatible service) from a Go server, on the official client `github.com/redis/go-redis/v9`. No Go-specific upstream skill exists to absorb. Redis publishes official agent skills ([redis/agent-skills](https://github.com/redis/agent-skills), MIT); two of them are vendored unchanged for the server side, `redis-security` (ACL users, TLS, network exposure) and `redis-observability` (what to monitor, `SLOWLOG`, `INFO`, `MEMORY DOCTOR`). Their client examples are Python and Java; this skill is the Go side, and wins where they differ. The others (`redis-core`, `redis-connections`, `redis-clustering`) are folded into this skill's references in Go form and not vendored.

The project wins where it differs ([go-how-to](../go-how-to/SKILL.md), rule 1). Read `go.mod` first: go-redis v9.23 needs Go 1.26 or later, and supports the last few Redis releases.

Related: [go-project-layout](../go-project-layout/SKILL.md) (the client lives in the Platform layer), [go-knadh-koanf](../go-knadh-koanf/SKILL.md) (the `redis` settings block, `password_file`), [go-concurrency](../go-concurrency/SKILL.md) (contexts, worker shutdown), [go-database](../go-database/SKILL.md) (the source of truth and correctness locks), [go-security](../go-security/SKILL.md) (`sec-no-secrets-in-logs`), [go-observability](../go-observability/SKILL.md) (zap, OpenTelemetry), [go-testing](../go-testing/SKILL.md) (`test-real-database`), [go-error-handling](../go-error-handling/SKILL.md), [go-how-to](../go-how-to/SKILL.md).

## When to use

- Adding Redis to a service, or changing how the client is built or configured
- A cache, a session store, a lock, a rate limiter, a counter, a leaderboard
- A stream consumer or producer, or a Pub/Sub subscriber
- A key schema, a TTL, a Lua script, a pipeline or a transaction
- A slow or failing Redis call, pool timeouts, `CROSSSLOT`, memory growth
- Reviewing a diff that touches go-redis

## The team's rules

- **One client per process,** built from the `redis` settings block in the Platform package that owns Redis, passed to constructors, closed on shutdown after the server and workers stop (`redis-one-client`).
- **The caller's context on every command,** and `ContextTimeoutEnabled: true` on every client so its deadline applies; dial, read and write timeouts stay set (`redis-context-deadline`).
- **`redis.Nil` is a miss**, matched with `errors.Is`; any other error is a failure, and on a cache path the service falls back to the source of truth (`redis-nil-is-miss`).
- **Keys are built in one place** from the configured prefix (`<service>:<entity>:<id>`), hold IDs rather than personal data, and are listed with their type and TTL in one key schema.
- **Every key expires** unless the schema says why it doesn't (`redis-ttl-on-keys`); collections are bounded and values small.
- **No `KEYS`, `FLUSHALL`, `FLUSHDB`** or unbounded full reads in service code: `SCAN` and `UNLINK` (`redis-no-keys-command`).
- **Read-modify-write is atomic:** one server-side command, a Lua script, or `WATCH` with a retry (`redis-atomic-read-modify-write`).
- **Locks carry a random token and a TTL** and are released only with that token; they stop duplicate work, they don't guarantee correctness (`redis-lock-token-release`).
- **Stream entries are acknowledged after processing,** stale pending entries reclaimed, handlers idempotent (`redis-stream-ack-after-processing`).
- **Instrumented with redisotel, without raw commands in spans** (`redis-otel-no-db-statement`).
- **Redis is never the only copy** of data the business can't lose, unless the project has decided so with persistence and a backup plan written down.

## Team decisions

1. **Client: go-redis v9.**

   | Library | Status | Why |
   |---|---|---|
   | `github.com/redis/go-redis/v9` | **Adopted** | Official Redis client, the most used and documented; one API for single server, Sentinel and cluster (`UniversalClient`); RESP3, OpenTelemetry (`redisotel`), Lua scripts, Streams; pooled, safe for concurrent use |
   | `github.com/redis/rueidis` | Not the default | Also Redis-maintained and faster under high concurrency (pipelines everything on shared connections, client-side caching built in), but a builder API (`client.B().Get().Key(k).Build()`) the team doesn't otherwise use. A project whose measurements show go-redis is the bottleneck may choose it; its `valkey-go` fork is the Valkey project's client |
   | `github.com/gomodule/redigo` | Not adopted | Manual connection handling, no context-first API, no cluster |
   | ORM-like layers over Redis | Not adopted | Hide which commands run, and their cost |

2. **`UniversalClient` in signatures.** Adapters take `redis.UniversalClient`, so the same code runs on a single server, Sentinel and a cluster; the settings decide which (`addrs`, `master_name`).
3. **Tests run against a real Redis** (testcontainers or a CI service), each test with its own key prefix. No command-level mocks; `miniredis` is not adopted for new code ([references/testing.md](references/testing.md)).
4. **Values are JSON** unless the project measured a reason for msgpack; never gob.
5. **Durable messaging between services goes to Kafka** (`go-kafka`) when it needs long retention, replay or other teams as consumers; Redis Streams are for work queues and short-lived events inside one system.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [redis-one-client](rules/redis-one-client.md) | Build one Redis client per process and close it on shutdown | HIGH | scan, review |
| [redis-context-deadline](rules/redis-context-deadline.md) | Run every command with the caller's context and let its deadline apply | HIGH | scan, review |
| [redis-otel-no-db-statement](rules/redis-otel-no-db-statement.md) | Instrument the client with redisotel, without raw commands in spans | HIGH | scan, review |
| [redis-nil-is-miss](rules/redis-nil-is-miss.md) | Treat redis.Nil as a miss, and every other error as an error | HIGH | scan, review |
| [redis-ttl-on-keys](rules/redis-ttl-on-keys.md) | Give every key a TTL unless it is documented as permanent | HIGH | scan, review |
| [redis-no-keys-command](rules/redis-no-keys-command.md) | Use SCAN, not KEYS, and no whole-keyspace commands in service code | HIGH | scan, review |
| [redis-atomic-read-modify-write](rules/redis-atomic-read-modify-write.md) | Make read-modify-write atomic with a single command, WATCH or a Lua script | HIGH | review |
| [redis-lock-token-release](rules/redis-lock-token-release.md) | Hold a lock with a random token and a TTL, and release it only with that token | HIGH | scan, review |
| [redis-stream-ack-after-processing](rules/redis-stream-ack-after-processing.md) | Acknowledge stream entries after processing, and reclaim stale pending ones | HIGH | scan, review |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, and against the checklist below. Read the key schema next to any new key.
5. **Report** in the format of [agent-skills-authoring](../agent-skills-authoring/SKILL.md) ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check the project doesn't run.

## Review checklist

- [ ] One client, built from settings, closed after the server and workers stop; `ContextTimeoutEnabled: true`
- [ ] The request's `ctx` on every command; no `context.Background()` in request code
- [ ] `errors.Is(err, redis.Nil)` for misses; Redis errors on a cache path logged and served from the source
- [ ] New keys built by the key functions, in the key schema, with a TTL; no personal data in keys
- [ ] No `KEYS`/`FLUSH*`; large collections read with `*SCAN` or ranges; values small, collections bounded
- [ ] Read-modify-write in one command, a script or `WATCH`; multi-key operations share a hash tag on a cluster
- [ ] Locks: random token, TTL, token-checked release; the work is safe if it runs twice
- [ ] Streams: ack after handling, `XAutoClaim`, trimmed `XAdd`, idempotent handler, dead-letter
- [ ] Cache invalidated after the database commit, by deleting the key
- [ ] `redisotel` with `WithDBStatement(false)`; credentials from `password_file` or secrets, never logged
- [ ] Tests against a real Redis with a per-test prefix; TTLs asserted

## 1. The client

Build it once in the Platform package that owns Redis (`internal/platform/redis` or the project's equivalent), from the `redis` block of the settings file:

```go
rdb := redis.NewUniversalClient(&redis.UniversalOptions{
	Addrs:                 cfg.Addrs,      // one: single server; several: cluster
	MasterName:            cfg.MasterName, // set: Sentinel
	Username:              cfg.Username,   // the service's ACL user
	Password:              password,       // from password_file or the secrets file
	DB:                    cfg.DB,
	TLSConfig:             tlsCfg,         // MinVersion TLS 1.2, the server's CA
	PoolSize:              cfg.PoolSize,   // 0: 10 per GOMAXPROCS
	DialTimeout:           cfg.DialTimeout,
	ReadTimeout:           cfg.ReadTimeout,
	WriteTimeout:          cfg.WriteTimeout,
	ContextTimeoutEnabled: true,
})
if err := errors.Join(
	redisotel.InstrumentTracing(rdb, redisotel.WithDBStatement(false)),
	redisotel.InstrumentMetrics(rdb),
); err != nil {
	_ = rdb.Close()
	return nil, fmt.Errorf("instrument redis: %w", err)
}
```

Then `Ping` with a short timeout, and return the client to `run`, which defers `Close`. The settings struct, the full constructor, pool and timeout guidance, retries and idempotency, credentials, TLS, readiness probes, shutdown order and Valkey notes: [references/client-setup.md](references/client-setup.md).

## 2. Commands, context and errors

```go
func (c *Sessions) Get(ctx context.Context, id string) (Session, bool, error) {
	b, err := c.rdb.Get(ctx, c.keys.Session(id)).Bytes()
	if errors.Is(err, redis.Nil) {
		return Session{}, false, nil
	}
	if err != nil {
		return Session{}, false, fmt.Errorf("get session: %w", err)
	}
	var s Session
	if err := json.Unmarshal(b, &s); err != nil {
		return Session{}, false, fmt.Errorf("decode session: %w", err)
	}
	return s, true, nil
}
```

- Every command returns a `*XxxCmd`; call `.Result()`, `.Err()`, `.Bytes()`, `.Int64()` once and check the error. A pipeline's result is per command.
- Typed checks for server conditions: `redis.IsLoadingError`, `IsReadOnlyError`, `IsClusterDownError`, `IsTryAgainError`, `IsOOMError`, `IsAuthError`, `IsPermissionError`; `redis.HasErrorPrefix(err, "BUSYGROUP")` for the rest.
- go-redis retries a command up to `MaxRetries` (3) on network errors and read timeouts. A non-idempotent command (`INCR`, `LPUSH`, `XADD` with an auto-generated ID) may then apply twice; design for it or disable retries on that client.
- Wrap errors with what was being done, not the value (`get session: %w`), per [go-error-handling](../go-error-handling/SKILL.md).

## 3. Keys and values

- `<prefix><entity>:<id>[:<part>]`, built by one function per entity from the configured `key_prefix`; one key schema lists each pattern, type, TTL and owner.
- Hash tags only for keys used together on a cluster (`orders:cart:{c-42}`); multi-key commands, `WATCH` transactions and scripts need one slot.
- Choose the type by access pattern (string, hash, set, sorted set, stream); JSON values by default; a few kilobytes per value; collections capped on write.
- TTLs in the same command as the write, jittered for caches; `KeepTTL` when overwriting a value whose expiry must stay.

Details, the data-type table, big keys, versioned keys and eviction policy: [references/keys-and-values.md](references/keys-and-values.md).

## 4. Caching, locks, rate limits and atomic updates

- **Cache-aside:** read Redis, on a miss (or a Redis error, logged) load from the database once per key with `singleflight`, write back with a jittered TTL. Negative-cache expensive misses briefly.
- **Invalidate after the commit** by deleting the key, not by writing the new value.
- **Locks:** `SetNX(ctx, key, token, ttl)`, release and extend with a token-checking script (or `DELEX ... IFEQ` on Redis 8.4+); correctness still comes from the database.
- **Rate limits:** a fixed-window counter in one Lua script, or GCRA (`github.com/go-redis/redis_rate/v10`); decide fail-open or fail-closed when Redis is down.
- **Atomic updates:** one command, a script (`redis.NewScript(...).Run`, sent as `EVALSHA`), or `Watch` with `TxPipelined`, retried on `redis.TxFailedErr`.
- **Pipelines** for many independent commands, in chunks; `MGET` only when the keys share a slot on a cluster.

Code for each, and when not to use them: [references/caching-and-coordination.md](references/caching-and-coordination.md).

## 5. Streams and Pub/Sub

Streams with a consumer group for work that must be done (at least once, acknowledged after handling, reclaimed with `XAutoClaim`, trimmed on `XAdd`, dead-lettered after repeated failures). Pub/Sub only for signals that may be lost. A consumer, a producer, a subscriber and the operational notes: [references/streams-and-pubsub.md](references/streams-and-pubsub.md).

## 6. Testing

The adapter is tested against a real Redis through a `redistest.Open(t)` helper that gives each test its own key prefix (testcontainers locally, `REDIS_URL` in CI); domain services that use a cache or a lock get a hand-written fake of their own small interface. Assert hits, misses, TTLs, behaviour with Redis down, lock ownership and concurrent updates: [references/testing.md](references/testing.md).

## 7. The server side

The service's ACL user, TLS on the server, `protected-mode` and network exposure: `redis-security`. What to monitor and alert on (memory against `maxmemory`, hit ratio, evictions, rejected connections, blocked clients) and the triage commands (`SLOWLOG GET`, `INFO`, `MEMORY DOCTOR`, `CLIENT LIST`, `redis-cli --bigkeys`): `redis-observability`. Both are Redis's own skills, vendored unchanged; read their client snippets as go-redis (`rdb.Info(ctx, "memory")`, `rdb.SlowLogGet(ctx, 10)`). Where the client side differs, this skill wins.

## Sources

- go-redis: [repository and README](https://github.com/redis/go-redis), [package docs](https://pkg.go.dev/github.com/redis/go-redis/v9), [guide](https://redis.uptrace.dev/guide/), [redisotel](https://pkg.go.dev/github.com/redis/go-redis/extra/redisotel/v9)
- Redis docs: [Go client guide](https://redis.io/docs/latest/develop/clients/go/), [pipelines and transactions](https://redis.io/docs/latest/develop/use/pipelining/), [transactions](https://redis.io/docs/latest/develop/interact/transactions/), [Lua scripting](https://redis.io/docs/latest/develop/interact/programmability/eval-intro/), [Streams](https://redis.io/docs/latest/develop/data-types/streams/), [distributed locks](https://redis.io/docs/latest/develop/use/patterns/distributed-locks/), [keys and expiry](https://redis.io/docs/latest/develop/use/keyspace/), [eviction](https://redis.io/docs/latest/develop/reference/eviction/), [cluster hash tags](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/#hash-tags)
- Martin Kleppmann, [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) (why a Redis lock is for efficiency, and fencing tokens)
- Redis's agent skills: [redis/agent-skills](https://github.com/redis/agent-skills)
