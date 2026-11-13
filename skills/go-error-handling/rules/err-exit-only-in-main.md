---
title: Exit and log.Fatal only in main, once
impact: MEDIUM
tags: errors, lifecycle, shutdown
check: scan
---

## Exit and log.Fatal only in main, once

**Impact: MEDIUM** (`os.Exit` skips deferred cleanup: open transactions, buffered logs and graceful shutdown are lost, and the code can't be tested)

`main` calls `run() error` and exits once on its result. Library code (everything outside `package main`) returns errors; it never calls `os.Exit`, `log.Fatal*`, `log.Panic*` or a logger's `Fatal`.

**Incorrect:**

```go
// internal/config
func Load() Config {
	b, err := os.ReadFile(path)
	if err != nil {
		log.Fatalf("read config: %v", err)
	}
	// ...
}
```

**Correct:**

```go
// internal/config
func Load(path string) (Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config %s: %w", path, err)
	}
	// ...
}

// cmd/server
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
```

**How to check:** `scripts/scan.sh` flags `os.Exit`, `log.Fatal*`, `log.Panic*` and `.Fatal(` outside `package main` and tests.
