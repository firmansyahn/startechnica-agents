---
title: Use SCAN, not KEYS, and no whole-keyspace commands in service code
impact: HIGH
tags: redis, performance, latency, commands
check: scan, review
---

## Use SCAN, not KEYS, and no whole-keyspace commands in service code

**Impact: HIGH** (Redis runs commands one at a time: `KEYS *` or a full read of a large collection blocks every other client for as long as it takes, and `FLUSHALL`/`FLUSHDB` deletes other services' data)

Iterate keys with `SCAN` (`rdb.Scan(...).Iterator()`; on a cluster, per primary with `ForEachMaster`) and large collections with `SSCAN`, `HSCAN`, `ZSCAN` or ranged reads. Delete many keys with `UNLINK` in batches, which frees memory off the main thread. `FLUSHALL`, `FLUSHDB`, `KEYS`, `DEBUG` and `CONFIG` never appear in service code; the service's ACL user should not be allowed them anyway (`redis-security`).

**Incorrect:**

```go
keys, err := c.rdb.Keys(ctx, "orders:session:*").Result() // blocks the server on a large keyspace
if err != nil {
	return err
}
c.rdb.Del(ctx, keys...)
```

**Correct:**

```go
iter := c.rdb.Scan(ctx, 0, "orders:session:*", 500).Iterator()
batch := make([]string, 0, 500)
for iter.Next(ctx) {
	batch = append(batch, iter.Val())
	if len(batch) == cap(batch) {
		if err := c.rdb.Unlink(ctx, batch...).Err(); err != nil {
			return err
		}
		batch = batch[:0]
	}
}
if err := iter.Err(); err != nil {
	return err
}
if len(batch) > 0 {
	return c.rdb.Unlink(ctx, batch...).Err()
}
return nil
```

**How to check:** `scripts/scan.sh` flags `.Keys(ctx`, `.FlushAll(`, `.FlushDB(` and `.FlushAllAsync(`/`.FlushDBAsync(` outside tests, and, as candidates, `.SMembers(`, `.HGetAll(` and `.LRange(..., 0, -1)`, which are fine only on collections the code keeps small. In review: `SLOWLOG GET` on a staging server (`redis-observability`).
