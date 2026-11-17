---
title: Make read-modify-write atomic with a single command, WATCH or a Lua script
impact: HIGH
tags: redis, concurrency, transactions, lua
check: review
---

## Make read-modify-write atomic with a single command, WATCH or a Lua script

**Impact: HIGH** (two instances read the same value, both write back their change, and one update is lost: oversold stock, wrong balances, counters that go backwards)

A `GET` followed by a `SET` computed from it is a race between instances. Use a command that does the change on the server (`INCRBY`, `HINCRBY`, `SET NX`, `ZADD GT`), an optimistic transaction (`rdb.Watch` with `TxPipelined`, retried on `redis.TxFailedErr`), or a Lua script (`redis.NewScript`, sent as `EVALSHA`). A plain `TxPipeline` (MULTI/EXEC) alone is not enough when the new value depends on a value read before it. On a cluster every key of the transaction or script shares one hash tag.

**Incorrect:**

```go
stock, err := c.rdb.Get(ctx, key).Int64()
if err != nil {
	return err
}
if stock < qty {
	return ErrOutOfStock
}
return c.rdb.Set(ctx, key, stock-qty, 0).Err() // another instance sold the same units
```

**Correct:**

```go
var reserve = redis.NewScript(`
local stock = tonumber(redis.call("GET", KEYS[1]) or "0")
if stock < tonumber(ARGV[1]) then return -1 end
return redis.call("DECRBY", KEYS[1], ARGV[1])`)

left, err := reserve.Run(ctx, c.rdb, []string{key}, qty).Int64()
if err != nil {
	return fmt.Errorf("reserve %s: %w", key, err)
}
if left < 0 {
	return ErrOutOfStock
}
```

**How to check:** review: a value read from Redis and written back in the same function, a balance or stock kept only in Redis (it belongs in the database, [go-database](../../go-database/SKILL.md)), a `Watch` without a retry on `redis.TxFailedErr`, and a multi-key script or transaction whose keys don't share a `{hash tag}` on a cluster.
