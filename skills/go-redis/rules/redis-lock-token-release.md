---
title: Hold a lock with a random token and a TTL, and release it only with that token
impact: HIGH
tags: redis, locks, concurrency
check: scan, review
---

## Hold a lock with a random token and a TTL, and release it only with that token

**Impact: HIGH** (a lock with no expiry stays held forever after a crash; a plain `DEL` releases a lock another instance acquired after yours expired, and two instances run the same job at once)

Acquire with `SET key <random token> NX PX <ttl>` (`SetNX(ctx, key, token, ttl)`), and release or extend with a script that compares the token first (or `DELEX key IFEQ <token>` on Redis 8.4 and later). Redis locks are for efficiency, to stop duplicate work; they are not safe for correctness across a pause or failover, so a job that must never run twice also needs a fencing check in the database (a unique constraint, a version column). Redlock is not adopted.

**Incorrect:**

```go
ok, _ := c.rdb.SetNX(ctx, "orders:lock:invoices", 1, 0).Result() // no expiry, no owner
if !ok {
	return nil
}
defer c.rdb.Del(ctx, "orders:lock:invoices") // may delete the next holder's lock
```

**Correct:**

```go
var release = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end
return 0`)

token := rand.Text() // crypto/rand, Go 1.24+
ok, err := c.rdb.SetNX(ctx, key, token, 30*time.Second).Result()
if err != nil || !ok {
	return err // not acquired: another instance runs it
}
defer func() {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second)
	defer cancel()
	if err := release.Run(ctx, c.rdb, []string{key}, token).Err(); err != nil {
		c.log.Warn("lock release failed; it expires on its own", zap.String("key", key), zap.Error(err))
	}
}()
```

**How to check:** `scripts/scan.sh` flags `SetNX(` with a TTL of `0`, and files that take a lock with `SetNX` and release with `.Del(` but have no `NewScript`/`DelExArgs`. In review: the TTL covers the job's worst case or is extended with the same token while it runs, and the job is safe if two copies do run.
