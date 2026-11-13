---
title: Return errors; don't panic in request or worker paths
impact: HIGH
tags: errors, panic, reliability
check: scan
---

## Return errors; don't panic in request or worker paths

**Impact: HIGH** (a panic in a goroutine that isn't the handler's kills the whole process; in a handler it drops the request without a useful status or log)

Code that can fail returns an error. `panic` is for programmer errors that can't happen (an exhaustive switch's default), `Must…` helpers called on constants at startup (`regexp.MustCompile`, `template.Must`), and nothing else. Misconfiguration at startup returns an error to `run()`. A worker goroutine that runs third-party code recovers at its top and logs, so one bad item doesn't stop the process.

**Incorrect:**

```go
func (s *Service) Load(ctx context.Context, id string) *Customer {
	z, err := s.store.Get(ctx, id)
	if err != nil {
		panic(err)
	}
	return z
}
```

**Correct:**

```go
func (s *Service) Load(ctx context.Context, id string) (*Customer, error) {
	z, err := s.store.Get(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("load customer %s: %w", id, err)
	}
	return z, nil
}
```

**How to check:** `scripts/scan.sh` flags `panic(` outside tests, `package main` and functions named `Must…`; confirm each is unreachable by input.
