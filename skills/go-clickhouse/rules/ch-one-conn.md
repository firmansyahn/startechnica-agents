---
title: Open one connection pool per process and close it on shutdown
impact: HIGH
tags: clickhouse, connections, lifecycle
check: scan (candidates), review
---

## Open one connection pool per process and close it on shutdown

**Impact: HIGH** (a connection opened per request or per job exhausts the server's connection and query limits under load, and one never closed leaves sockets and in-flight batches behind)

`clickhouse.Open` returns a `driver.Conn` that is a pool and safe for concurrent use. Open it once at start in the Platform package that owns ClickHouse, `Ping` it so a wrong address fails the start, pass it to constructors, and close it on shutdown after the writers have flushed.

**Incorrect:**

```go
func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	conn, err := clickhouse.Open(&clickhouse.Options{Addr: []string{h.addr}})
	if err != nil {
		// ...
	}
	var n uint64
	_ = conn.QueryRow(r.Context(), "SELECT count() FROM page_views").Scan(&n) // conn never closed
}
```

**Correct:**

```go
// cmd/<binary>/main.go, inside run()
conn, err := chstore.Open(ctx, cfg.ClickHouse) // clickhouse.Open + Ping
if err != nil {
	return err
}
defer conn.Close()
store := chstore.New(conn, log)
writer := chstore.NewPageViewWriter(store, log, chstore.WriterConfig{})
defer writer.Close() // flushes before conn.Close runs (defers run last in, first out)
```

**How to check:** `scripts/scan.sh` lists every `clickhouse.Open`/`OpenDB` call outside `main` and tests; there should be one, in the package that owns ClickHouse. In review, confirm the conn is closed at shutdown and nothing opens one per request.
