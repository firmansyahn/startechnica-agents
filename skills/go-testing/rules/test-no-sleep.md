---
title: Wait on signals in tests, never on time.Sleep
impact: MEDIUM
tags: tests, flakiness, concurrency
check: scan
---

## Wait on signals in tests, never on time.Sleep

**Impact: MEDIUM** (sleep-based tests are slow on fast machines and flaky on slow CI runners)

A test waits for the event it expects: a channel the code signals, a returned `Run`, a polled condition with a deadline, or an injected clock it advances. For time-based code, `testing/synctest` (Go 1.25+) runs the code on a fake clock so `time.Sleep` and tickers inside the bubble finish instantly and deterministically.

**Incorrect:**

```go
go w.Run(ctx)
w.Enqueue(job)
time.Sleep(200 * time.Millisecond)
if got := store.Count(); got != 1 {
	t.Fatalf("count = %d", got)
}
```

**Correct:**

```go
synctest.Test(t, func(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	go w.Run(ctx)
	w.Enqueue(job)
	synctest.Wait() // every goroutine in the bubble is blocked: the job is done
	if got := store.Count(); got != 1 {
		t.Fatalf("count = %d, want 1", got)
	}
})
```

**How to check:** `scripts/scan.sh` flags `time.Sleep(` in `_test.go` files. Sleeps inside a `synctest` bubble are fine.
