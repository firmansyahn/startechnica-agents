# Caching, locks, rate limits and atomic updates

The team skill wins; this is the detail behind its section 4. The examples use a `redis.UniversalClient` named `rdb` and keys from the service's key functions ([keys-and-values.md](keys-and-values.md)).

## Cache-aside

The database is the source of truth; Redis holds a copy that may be missing, stale for at most its TTL, or unreachable.

```go
type Customers struct {
	rdb   redis.UniversalClient
	keys  Keys
	db    CustomerStore // the database accessor
	ttl   time.Duration
	group singleflight.Group // golang.org/x/sync/singleflight
	log   *zap.Logger
}

func jitter(d time.Duration) time.Duration { return d + rand.N(d/10+1) } // math/rand/v2

// Get reads the cache, and on a miss or a Redis failure loads from the database once per key.
func (c *Customers) Get(ctx context.Context, id string) (Customer, error) {
	key := c.keys.Customer(id)
	b, err := c.rdb.Get(ctx, key).Bytes()
	switch {
	case err == nil:
		var cu Customer
		if err := json.Unmarshal(b, &cu); err == nil {
			return cu, nil
		}
		// undecodable (an old shape): refill below
	case errors.Is(err, redis.Nil):
		// miss
	default:
		c.log.Warn("redis get failed, reading the database", zap.String("key", key), zap.Error(err))
	}

	v, err, _ := c.group.Do(key, func() (any, error) {
		// One load per key for every waiter: detach from this caller's cancellation, keep a deadline.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
		defer cancel()
		cu, err := c.db.GetCustomer(ctx, id)
		if err != nil {
			return Customer{}, err
		}
		if b, err := json.Marshal(cu); err == nil {
			if err := c.rdb.Set(ctx, key, b, jitter(c.ttl)).Err(); err != nil {
				c.log.Warn("redis set failed", zap.String("key", key), zap.Error(err))
			}
		}
		return cu, nil
	})
	if err != nil {
		return Customer{}, fmt.Errorf("get customer %s: %w", id, err)
	}
	return v.(Customer), nil
}
```

- **A Redis failure is not a request failure** on a cache path: log it, count it, serve from the database. If the database can't take the full load without the cache, that is a capacity limit to state in the design, with a circuit breaker or load shedding, not a reason to fail every request when Redis blips.
- **Stampede protection:** `singleflight` collapses concurrent misses for one key within one instance; jittered TTLs stop keys written together from expiring together. For a key that is very hot across many instances, refresh it before it expires (a background refresh, or probabilistic early expiry), or take a short `SET NX` "loading" key so only one instance loads it.
- **Negative caching:** when "not found" is common and expensive (lookups by external ID), cache the miss as a sentinel value with a short TTL (tens of seconds), and delete it when the entity is created.
- **Invalidate after the commit:** the write path commits to the database, then deletes the cache key (`UNLINK`). Deleting is safer than writing the new value: two concurrent writers can write their values in the opposite order to their commits. Delete before the commit and a reader can refill the old value in between.
- **Lost invalidations:** a failed delete leaves a stale value until its TTL. Keep TTLs short enough that this is acceptable, retry the delete, or publish the change (an outbox, a stream) and let a consumer invalidate.
- **Don't cache what must be fresh:** balances, stock, permissions checked for a write. Read those from the database.
- **Client-side caching:** go-redis can keep hot keys in process memory, invalidated by the server over RESP3 (`ClientSideCacheConfig`, experimental in v9). It is eventually consistent; adopt it only for read-mostly keys after measuring, and not with a credentials provider (it turns itself off).

## Locks

Read `redis-lock-token-release` first. A Redis lock stops two instances doing the same work at the same time *most* of the time; a GC pause, a network partition or a failover to a replica that hadn't received the lock can still let two holders run. Use one for efficiency (a scheduled job, a cache rebuild), and make the work itself safe to run twice. For correctness, use the database: a unique constraint, `SELECT ... FOR UPDATE`, an advisory lock, or a fencing token checked on write ([go-database](../../go-database/SKILL.md)).

```go
var ErrNotAcquired = errors.New("lock not acquired")

type Lock struct {
	rdb   redis.UniversalClient
	key   string
	token string
}

func Acquire(ctx context.Context, rdb redis.UniversalClient, key string, ttl time.Duration) (*Lock, error) {
	token := rand.Text() // crypto/rand, Go 1.24+
	ok, err := rdb.SetNX(ctx, key, token, ttl).Result()
	if err != nil {
		return nil, fmt.Errorf("acquire %s: %w", key, err)
	}
	if !ok {
		return nil, ErrNotAcquired
	}
	return &Lock{rdb: rdb, key: key, token: token}, nil
}

var releaseScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0`)

var extendScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
return 0`)

// Release deletes the key only if it still holds this lock's token.
func (l *Lock) Release(ctx context.Context) error {
	n, err := releaseScript.Run(ctx, l.rdb, []string{l.key}, l.token).Int()
	if err != nil {
		return fmt.Errorf("release %s: %w", l.key, err)
	}
	if n == 0 {
		return fmt.Errorf("release %s: %w", l.key, ErrNotAcquired) // it had expired
	}
	return nil
}

// Extend pushes the expiry out while the job still runs; stop the job when it fails.
func (l *Lock) Extend(ctx context.Context, ttl time.Duration) error {
	n, err := extendScript.Run(ctx, l.rdb, []string{l.key}, l.token, ttl.Milliseconds()).Int()
	if err != nil {
		return fmt.Errorf("extend %s: %w", l.key, err)
	}
	if n == 0 {
		return fmt.Errorf("extend %s: %w", l.key, ErrNotAcquired)
	}
	return nil
}
```

- On Redis 8.4 and later, `rdb.DelExArgs(ctx, key, redis.DelExArgs{Mode: "IFEQ", MatchValue: token})` releases without a script. Keep the script where the server version isn't known (Valkey, managed services).
- `github.com/bsm/redislock` implements the same pattern on go-redis (tokens, release and refresh scripts, retry strategies) and is fine where a project prefers a library.
- Redlock (a lock across several independent masters) is not adopted: it adds operational cost without making the lock safe for correctness.

## Rate limiting

| Algorithm | Shape | Use |
|---|---|---|
| Fixed window | `INCR` a key per client and window, expiry set on the first hit | Simple quotas; allows up to twice the limit across a window edge |
| Sliding window log | Sorted set of request timestamps: `ZREMRANGEBYSCORE` old, `ZCARD`, `ZADD`, in one script | Exact, but one entry per request: small limits only |
| GCRA / token bucket | One key per client holding the next allowed time | Smooth limits at any rate; `github.com/go-redis/redis_rate/v10` implements it on go-redis |

```go
var fixedWindow = redis.NewScript(`
local n = redis.call("INCR", KEYS[1])
if n == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return n`)

// Allow counts one request for key in the current window.
func Allow(ctx context.Context, rdb redis.UniversalClient, key string, limit int64, window time.Duration) (bool, error) {
	n, err := fixedWindow.Run(ctx, rdb, []string{key}, window.Milliseconds()).Int64()
	if err != nil {
		return false, fmt.Errorf("rate limit %s: %w", key, err)
	}
	return n <= limit, nil
}
```

`INCR` and `EXPIRE` as two separate calls leave a counter with no expiry when the process dies between them; keep them in one script (or `INCR` plus `EXPIRE ... NX` in one `TxPipelined`). Decide what happens when Redis is down: fail open (allow) for a fairness limit, fail closed for a limit that protects against abuse, and say which in the code.

## Atomic read-modify-write

Read `redis-atomic-read-modify-write`. In order of preference:

1. **One command** that does it on the server: `INCRBY`, `HINCRBY`, `SET NX`, `GETDEL`, `ZADD GT`, `LMOVE`.
2. **A Lua script** (`redis.NewScript`): runs atomically; `Script.Run` sends `EVALSHA` and falls back to `EVAL` when the server doesn't have the script cached. Keep scripts short (they block the server while they run), pass every key in `KEYS` (a cluster routes by them, and they must share a hash tag), and keep them as package-level variables so the SHA is computed once.
3. **`WATCH` with a retry:**

```go
func AddCredits(ctx context.Context, rdb redis.UniversalClient, key string, delta int64) error {
	const maxRetries = 5
	txf := func(tx *redis.Tx) error {
		cur, err := tx.Get(ctx, key).Int64()
		if err != nil && !errors.Is(err, redis.Nil) {
			return err
		}
		next := cur + delta
		if next < 0 {
			return ErrInsufficientCredits
		}
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, key, next, 24*time.Hour)
			return nil
		})
		return err
	}
	for range maxRetries {
		err := rdb.Watch(ctx, txf, key)
		if errors.Is(err, redis.TxFailedErr) {
			continue // the key changed between the read and the write: retry
		}
		return err
	}
	return fmt.Errorf("add credits %s: too much contention", key)
}
```

`TxPipelined` alone (MULTI/EXEC) makes a batch atomic, but it can't decide on a value read inside it; that needs `WATCH` or a script. Redis has no rollback: a command that fails inside `EXEC` doesn't undo the others.

## Pipelines and batches

- `Pipelined` sends many independent commands in one round trip; results come back per command. Read each `cmd.Result()` and treat `redis.Nil` per command: the pipeline's own error is the first failed command's, which may be a `redis.Nil`.

```go
func GetMany(ctx context.Context, rdb redis.UniversalClient, keys []string) (map[string]string, error) {
	cmds := make([]*redis.StringCmd, len(keys))
	_, err := rdb.Pipelined(ctx, func(p redis.Pipeliner) error {
		for i, k := range keys {
			cmds[i] = p.Get(ctx, k)
		}
		return nil
	})
	if err != nil && !errors.Is(err, redis.Nil) {
		return nil, err
	}
	out := make(map[string]string, len(keys))
	for i, c := range cmds {
		v, err := c.Result()
		if errors.Is(err, redis.Nil) {
			continue
		}
		if err != nil {
			return nil, err
		}
		out[keys[i]] = v
	}
	return out, nil
}
```

- Batch in chunks of a few hundred to a few thousand commands: one huge pipeline holds a connection and buffers every reply in memory.
- `MGET`/`MSET` are single commands and faster still, but on a cluster all keys need one slot; a pipeline of `GET`s works across slots.
- go-redis v9 also has automatic pipelining (`AutoPipeline`, experimental) that batches concurrent commands from many goroutines; measure before adopting it.
