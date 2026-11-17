---
title: Treat redis.Nil as a miss, and every other error as an error
impact: HIGH
tags: redis, errors, cache
check: scan, review
---

## Treat redis.Nil as a miss, and every other error as an error

**Impact: HIGH** (a miss returned as a failure turns every cold key into a 500; an outage treated as a miss hides itself and sends the full load to the database)

`GET`, `HGET`, `LPOP`, `XREADGROUP` with no entries and other commands with no value return `redis.Nil`. Match it with `errors.Is(err, redis.Nil)` (it survives wrapping; `==` doesn't) and handle it as "not there". Any other error is a failure: on a cache path, log it with the key and fall back to the source of truth; on a path where Redis is the store, return it wrapped.

**Incorrect:**

```go
v, err := c.rdb.Get(ctx, key).Result()
if err != nil {
	return nil, err // a miss becomes a failure
}

b, err := c.rdb.Get(ctx, key).Bytes()
if err == redis.Nil || err != nil { // an outage looks like a miss, silently
	return c.db.GetItem(ctx, id)
}
```

**Correct:**

```go
b, err := c.rdb.Get(ctx, key).Bytes()
switch {
case err == nil:
	return decodeItem(b)
case errors.Is(err, redis.Nil):
	// miss: load and fill below
default:
	c.log.Warn("redis get failed, reading the database", zap.String("key", key), zap.Error(err))
}
return c.loadAndFill(ctx, id)
```

**How to check:** `scripts/scan.sh` flags `== redis.Nil` and `!= redis.Nil` (use `errors.Is`). In review: a `Get(...).Result()` whose error is returned with no `redis.Nil` branch, and an `if err != nil` fallback that treats every error as a miss without logging or counting it.
