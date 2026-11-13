---
title: Give every goroutine a stop signal and a wait
impact: HIGH
tags: concurrency, goroutines, shutdown, leaks
check: test, review
---

## Give every goroutine a stop signal and a wait

**Impact: HIGH** (leaked goroutines grow memory without bound, keep using a closed database, and make shutdown lose in-flight work)

Every `go` statement has an owner that can stop it (a `context.Context` or a stop channel) and wait for it (a `sync.WaitGroup`, `wg.Go` on Go 1.25+, an `errgroup.Group`, or a done channel). Workers expose `Run(ctx) error` or `Start(ctx)`/`Stop()`. Fan-out that must fail together uses `errgroup.WithContext`, with `SetLimit` when the input is unbounded. A goroutine that sends on a channel must also be able to give up when nobody receives.

**Incorrect:**

```go
func (p *Poller) Start() {
	go func() {
		for {
			p.poll(context.Background())
			time.Sleep(time.Minute)
		}
	}()
}
```

**Correct:**

```go
func (p *Poller) Run(ctx context.Context) error {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for {
		p.poll(ctx)
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
		}
	}
}

// fan-out
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(8)
for _, d := range devices {
	g.Go(func() error { return p.check(ctx, d) })
}
return g.Wait()
```

**How to check:** a test per worker package that starts it, cancels it and checks that it returned (where the project already uses `go.uber.org/goleak`, `VerifyNone` in `TestMain` also catches leaks across the package). In review, for each `go` find the line that stops it and the line that waits for it.
