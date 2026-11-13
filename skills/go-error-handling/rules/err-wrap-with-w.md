---
title: Wrap with %w and short context, without "failed to"
impact: MEDIUM
tags: errors, wrapping
check: scan, lint (errorlint)
---

## Wrap with %w and short context, without "failed to"

**Impact: MEDIUM** (`%v` cuts the chain, so `errors.Is` upstream stops matching; "failed to" stacks into "failed to x: failed to y: failed to z")

Wrap with `%w` and a short phrase naming the operation and its key value: `fmt.Errorf("load tenant %s: %w", id, err)`. Use `%v` only to hide a cause on purpose (an internal error at a public boundary). No "failed to", "error", "unable to": the chain already says it failed.

**Incorrect:**

```go
return fmt.Errorf("failed to load tenant: %v", err)
```

**Correct:**

```go
return fmt.Errorf("load tenant %s: %w", id, err)
```

**How to check:** `scripts/scan.sh` flags `fmt.Errorf` that formats `err` with `%v`/`%s` and no `%w`, and error strings starting with "failed to"/"unable to"/"error". `errorlint` catches the `%v` case.
