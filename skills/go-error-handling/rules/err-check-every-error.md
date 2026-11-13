---
title: Check every returned error
impact: HIGH
tags: errors, errcheck
check: lint (errcheck)
---

## Check every returned error

**Impact: HIGH** (a failed write, close or commit is silently treated as success; data is lost with no log)

Every error is checked, returned or deliberately discarded with `_ =` and a comment saying why. `Close` on something written to (a file, a gzip writer, a transaction) is checked, because that is where buffered writes fail. `defer f.Close()` is fine for read-only handles.

**Incorrect:**

```go
json.NewEncoder(f).Encode(report)
f.Close()
tx.Commit(ctx)
```

**Correct:**

```go
if err := json.NewEncoder(f).Encode(report); err != nil {
	return fmt.Errorf("encode report: %w", err)
}
if err := f.Close(); err != nil {
	return fmt.Errorf("close report: %w", err)
}
if err := tx.Commit(ctx); err != nil {
	return fmt.Errorf("commit: %w", err)
}
```

**How to check:** `errcheck` (in `golangci-lint`'s default set). Without it, look for calls on their own line to functions that return an error, especially `Close`, `Commit`, `Write`, `Encode`, `Flush`.
