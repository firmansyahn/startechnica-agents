---
title: Inject dependencies; no mutable package globals
impact: MEDIUM
tags: architecture, globals, testability
check: scan (candidates), lint (gochecknoglobals)
---

## Inject dependencies; no mutable package globals

**Impact: MEDIUM** (hidden shared state: tests interfere with each other, can't run in parallel, and need monkey-patching; data races between requests)

Constructors take what they use (`NewService(db *database.DB, log *zap.Logger, now func() time.Time)`). Package-level `var`s are for read-only tables, sentinel errors, compiled regexps and interface checks only. Caches, clients, loggers, config and clocks are fields, set by the composition root.

**Incorrect:**

```go
var (
	cache  = map[string]Customer{}
	client = &http.Client{}
	now    = time.Now // patched in tests
)
```

**Correct:**

```go
type Service struct {
	mu     sync.Mutex
	cache  map[string]Customer
	client *http.Client
	now    func() time.Time
}

func NewService(client *http.Client, now func() time.Time) *Service {
	return &Service{cache: make(map[string]Customer), client: client, now: now}
}
```

**How to check:** `scripts/scan.sh` flags package-level `var`s initialised with `make`, a map or slice literal, `&T{}`, `new(…)`, or declared as a map, slice or pointer, outside tests. Read-only lookup tables are fine; say so in a comment.
