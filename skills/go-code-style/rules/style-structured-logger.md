---
title: Log through the injected structured logger
impact: LOW
tags: style, logging
check: scan
---

## Log through the injected structured logger

**Impact: LOW** (`log.Printf` and `fmt.Println` lines lack levels, fields and the request id, so they can't be searched or alerted on, and they bypass redaction)

Library code logs through the `*zap.Logger` it was given (the team's logger; a project whose `AGENTS.md` settles on another keeps it) with typed fields and a constant message, using the project's field names (ECS, OpenTelemetry). Not `zap.L()`, `zap.S()` or a `SugaredLogger`: the global hides the dependency, and the sugared key-value pairs are untyped. The standard `log` package and `fmt.Print*` are for `package main` and command-line tools only.

**Incorrect:**

```go
log.Printf("customer %s synced in %v", id, time.Since(start))
```

**Correct:**

```go
s.log.Info("customer synced", zap.String("customer_id", id), zap.Duration("duration", time.Since(start)))
```

**How to check:** `scripts/scan.sh` flags `log.Print*` and `fmt.Print*` outside `package main` and tests.
