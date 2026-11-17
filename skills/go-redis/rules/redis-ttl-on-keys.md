---
title: Give every key a TTL unless it is documented as permanent
impact: HIGH
tags: redis, memory, keys, expiry
check: scan, review
---

## Give every key a TTL unless it is documented as permanent

**Impact: HIGH** (keys without an expiry pile up until `maxmemory` is reached; then the eviction policy drops data the service relies on, or writes fail with OOM)

Every key a service writes carries an expiry that matches how long the data is useful: set it in the same command (`Set(ctx, k, v, ttl)`, `SetArgs{TTL: ...}`), or in the same pipeline or script for hashes, sets, lists and counters (`Expire`, `ExpireNX`). A key that must live forever is named in the key schema with the reason. Rewriting a value with `Set(..., 0)` also removes an existing TTL; use `KeepTTL` when that isn't wanted.

**Incorrect:**

```go
c.rdb.Set(ctx, c.key(id), b, 0)          // never expires
c.rdb.HSet(ctx, cartKey, itemID, qty)    // hash grows forever
c.rdb.Incr(ctx, "orders:views:"+itemID)  // counter never cleaned up
```

**Correct:**

```go
c.rdb.Set(ctx, c.key(id), b, jitter(c.ttl))

_, err := c.rdb.TxPipelined(ctx, func(p redis.Pipeliner) error {
	p.HSet(ctx, cartKey, itemID, qty)
	p.Expire(ctx, cartKey, 7*24*time.Hour) // the cart lives a week after its last change
	return nil
})
```

**How to check:** `scripts/scan.sh` flags `.Set(` and `.SetNX(` calls whose last argument is `0`, and files that write collections or counters (`HSet`, `SAdd`, `RPush`, `LPush`, `ZAdd`, `Incr`, `IncrBy`, `HIncrBy`) without any `Expire`/`PExpire`/`ExpireNX` in the file. In review: the key schema lists each key with its TTL; `redis-cli --bigkeys` and `INFO keyspace` (keys versus `expires`) on a staging server show what is left without one.
