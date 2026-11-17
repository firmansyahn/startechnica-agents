---
title: Insert in large batches, never one row per INSERT
impact: HIGH
tags: clickhouse, inserts, performance
check: scan (candidates), review
---

## Insert in large batches, never one row per INSERT

**Impact: HIGH** (every INSERT creates a data part; one row per INSERT creates thousands of tiny parts, merges fall behind and the server rejects inserts with "too many parts")

Send thousands of rows per INSERT (10,000 to 100,000 is the target, at least 1,000) and about one INSERT per second per table, through `PrepareBatch` … `Send`. A service that gets rows one at a time buffers them in a writer that flushes by size and age ([references/inserts.md](../references/inserts.md)); only when many producers can't share a writer, use async inserts that wait for the flush (`ch-async-insert-wait`). Upstream: `insert-batch-size` in [clickhouse-best-practices](../../clickhouse-best-practices/SKILL.md).

**Incorrect:**

```go
func (h *Handler) Track(w http.ResponseWriter, r *http.Request) {
	// ... decode ev
	err := h.conn.Exec(r.Context(),
		"INSERT INTO page_views (ts, site_id, path) VALUES (?, ?, ?)", ev.TS, ev.SiteID, ev.Path)
	// one part per request
}
```

**Correct:**

```go
func (h *Handler) Track(w http.ResponseWriter, r *http.Request) {
	// ... decode ev
	if err := h.views.Add(r.Context(), ev); err != nil { // buffered writer; flushes 50,000 rows or every 2s
		// writer full: 503, the client retries
	}
}
```

**How to check:** `scripts/scan.sh` flags `Exec` calls whose SQL starts with `INSERT`, and `PrepareBatch` inside a `for` loop body; each is a candidate (a one-off backfill of a big `INSERT … SELECT` is fine). In review, follow the insert path and confirm how many rows one INSERT carries under real traffic.
