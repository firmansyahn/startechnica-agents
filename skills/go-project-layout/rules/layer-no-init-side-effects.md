---
title: No I/O, env reads or goroutines in init()
impact: MEDIUM
tags: architecture, init, lifecycle
check: scan, lint (gochecknoinits)
---

## No I/O, env reads or goroutines in init()

**Impact: MEDIUM** (`init` runs on import, in every test and tool, in an order you don't control; it can't return an error, take a context or be stopped)

`init()` holds only deterministic setup of constants (building a read-only table from a literal). Config, environment, files, network, database and goroutines go through constructors called from `main`/the composition root, which can return errors and be shut down.

**Incorrect:**

```go
var db *pgxpool.Pool

func init() {
	db, _ = pgxpool.New(context.Background(), os.Getenv("DB_DSN"))
	go refreshCache()
}
```

**Correct:**

```go
func run(ctx context.Context, cfg Config) error {
	db, err := pgxpool.New(ctx, cfg.DSN)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer db.Close()
	cache := customer.NewCache(db)
	go cache.Run(ctx) // owned and stopped by run's context
	// ...
}
```

**How to check:** `scripts/scan.sh` lists every `func init()` outside tests; open each and confirm it only builds constants. `gochecknoinits` bans them outright.
