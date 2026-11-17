# Keys, data types and values

The team skill wins; this is the detail behind its section 3.

## The key schema

Every key a service writes is built by one function per entity in the package that owns Redis, from the configured prefix, and the service documents its keys in one place (a comment block or `docs/redis-keys.md`): pattern, type, TTL, who writes it and who reads it.

```go
// Keys written by the orders service (prefix from redis.key_prefix, default "orders:"):
//
//	orders:customer:<id>          string (JSON)   1h ± 10%   cache of customers.Get
//	orders:cart:{<customer-id>}   hash            7d         item ID -> quantity
//	orders:rl:<client>:<window>   string (int)    window     rate limit counter
//	orders:lock:<job>             string (token)  30s        job lock (redis-lock-token-release)
//	orders:events                 stream          ~100k      order events, MAXLEN trimmed
type Keys struct{ prefix string }

func (k Keys) Customer(id string) string { return k.prefix + "customer:" + id }
func (k Keys) Cart(customerID string) string { return k.prefix + "cart:{" + customerID + "}" }
```

- **Shape:** `<prefix><entity>:<id>[:<part>]`, lower case, colon-separated. The prefix is the service (and the tenant where there are tenants: `orders:t:<tenant>:...`), so an ACL key pattern (`~orders:*`), a `SCAN MATCH` and a memory report can all target one service.
- **IDs, not personal data, in keys:** keys show up in `SLOWLOG`, `MONITOR`, spans and logs. Use the customer ID, not the email; hash a long or sensitive natural key (`sha256` hex, truncated) before using it.
- **Short but readable:** keys take memory and travel with every command; don't use URLs or JSON as keys.
- **Versioned when the value's shape changes incompatibly:** `orders:v2:customer:<id>`, so old and new instances in a rolling deploy don't decode each other's values. The old keys expire on their own.
- **Built in one place:** no `fmt.Sprintf("orders:customer:%s", id)` spread through handlers; a typo there writes a key nothing reads and nothing expires.

## Hash tags on a cluster

A cluster places a key by the hash of the part between the first `{` and the next `}` when there is one. Commands that touch several keys (`MGET`, `SUNIONSTORE`, `RENAME`, `WATCH`/`MULTI` transactions, Lua scripts with several `KEYS`) work only when every key is in the same slot, otherwise they fail with `CROSSSLOT`.

- Tag only the keys that are used together, with the entity that groups them: `orders:cart:{c-42}` and `orders:cart-total:{c-42}`. Not a bare `{42}` that unrelated entities share, and not one tag for everything, which puts all the load on one shard.
- Plain pipelines (`Pipelined`) are fine without tags: the cluster client splits them per node. `TxPipelined`, `Watch` and scripts are not.
- Design the tags before the first deploy: renaming keys in production means a dual-write migration.
- `redis-clustering` (Redis's own skill, not vendored) has more; the hash-tag section of the [cluster specification](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/#hash-tags) is the reference.

## Choosing the data type

| Need | Type | Commands |
|---|---|---|
| A cached object read and written whole | String with JSON (or msgpack) | `GET`, `SET ... EX` |
| An object whose fields change independently | Hash | `HSET`, `HGET`, `HINCRBY`, `HEXPIRE` (per-field TTL, Redis 7.4+) |
| A counter | String | `INCR`, `INCRBY` with an expiry |
| Membership, unique visitors | Set (or HyperLogLog when an estimate is enough) | `SADD`, `SISMEMBER`, `PFADD` |
| Ranking, a time-ordered index, a sliding window | Sorted set | `ZADD`, `ZRANGE ... BYSCORE`, `ZREMRANGEBYSCORE` |
| A durable queue or event log with consumer groups | Stream | `XADD`, `XREADGROUP`, `XACK` ([streams-and-pubsub.md](streams-and-pubsub.md)) |
| A simple work queue where losing an item on crash is acceptable | List | `LPUSH`, `BLMOVE` |
| Documents queried by field, vectors | JSON, Search, vector sets | Only where the server has them; the project decides |

## Values

- **Encoding:** JSON by default (`encoding/json`, the struct's `json` tags), readable in `redis-cli` and safe across languages. Msgpack (`github.com/vmihailenco/msgpack/v5`) when size or CPU matter and only Go reads the value. Never `encoding/gob` (Go-only, schema-fragile). Whatever the encoding, a value that doesn't decode is a miss: log it, delete or overwrite it, read the source.
- **Size:** keep values to a few kilobytes and look hard at anything over about 100 KB: a big value blocks the server while it is copied, saturates the network on every read, and makes eviction and failover slow. Cache a page of a list, not the whole list; split a large object into a hash.
- **Bounded collections:** a hash, set, list, sorted set or stream that grows without limit is a big key. Cap it on write (`LTRIM`, `ZREMRANGEBYRANK`, `XADD MAXLEN ~`), or partition it by time (`orders:views:<yyyymmdd>` with a TTL). Find big keys with `redis-cli --bigkeys` or `--memkeys` on a replica, and `MEMORY USAGE <key>`.
- **Compression:** only for large text values that must stay large; it costs CPU on every read and hides the size problem.

## Expiry

- A TTL in the same command as the write (`redis-ttl-on-keys`). Jitter cache TTLs (± 10 %) so keys written together don't expire together.
- `SET` without a TTL removes an existing one; `SetArgs{KeepTTL: true}` keeps it.
- `EXPIRE ... NX` (`ExpireNX`) sets a TTL only on a key that has none: a counter's window starts at its first increment.
- The server's `maxmemory-policy` decides what happens at the memory limit. A cache-only server uses `allkeys-lru` or `allkeys-lfu`; a server that also holds locks, streams or rate limits uses `volatile-*` or `noeviction`, and then every key's TTL matters even more. Ask what the server runs before relying on either.
