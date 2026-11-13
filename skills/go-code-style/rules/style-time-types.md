---
title: Use time.Duration and time.Time, or put the unit in the name
impact: LOW
tags: style, time, units
check: scan
---

## Use time.Duration and time.Time, or put the unit in the name

**Impact: LOW** (a bare `Timeout int` is read as seconds by one caller and milliseconds by another)

Periods are `time.Duration`, instants are `time.Time` (stored in UTC). When a wire format or config forces an integer, the unit is in the name (`TimeoutSec`, `IntervalMs`, `TTLMinutes`) and converted to a `Duration` at the edge.

**Incorrect:**

```go
type PollerConfig struct {
	Interval int `json:"interval"`
	Timeout  int `json:"timeout"`
}
time.Sleep(time.Duration(cfg.Interval)) // nanoseconds
```

**Correct:**

```go
type PollerConfig struct {
	IntervalSec int `json:"interval_sec"`
	TimeoutSec  int `json:"timeout_sec"`
}

func (c PollerConfig) Interval() time.Duration { return time.Duration(c.IntervalSec) * time.Second }
```

**How to check:** `scripts/scan.sh` flags struct fields named `…Timeout`, `…Interval`, `…TTL`, `…Delay`, `…Period`, `…Expiry` or `…Age` whose type is an integer.
