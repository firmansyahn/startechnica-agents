---
title: Size channels one or none, or say what bounds them
impact: MEDIUM
tags: concurrency, channels, backpressure
check: scan
---

## Size channels one or none, or say what bounds them

**Impact: MEDIUM** (a large buffer hides a slow consumer until it fills, then blocks just like an unbuffered one, under load, in production)

Channels are unbuffered or have a buffer of one. A bigger buffer needs a comment saying what bounds it and what happens when it is full (block, drop with a metric, or refuse). The sender closes a channel, never the receiver; a send that could block forever selects on `ctx.Done()` too.

**Incorrect:**

```go
events := make(chan Event, 10000)
```

**Correct:**

```go
// Bounded by the number of devices polled per cycle (at most cfg.MaxDevices); a full queue drops
// the event and counts it in events_dropped_total.
events := make(chan Event, cfg.MaxDevices)

select {
case events <- ev:
case <-ctx.Done():
	return ctx.Err()
default:
	dropped.Inc()
}
```

**How to check:** `scripts/scan.sh` flags `make(chan T, N)` with a literal N above 1 and no comment on the line or the line above.
