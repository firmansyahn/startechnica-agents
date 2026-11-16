---
title: Fail CI when go mod tidy changes module files
impact: MEDIUM
tags: ci, modules, dependencies
check: ci, review
---

## Fail CI when go mod tidy changes module files

**Impact: MEDIUM** (module metadata can drift from the committed dependency graph, causing local and CI builds to resolve differently)

Run `go mod tidy` in CI and fail if it changes `go.mod` or `go.sum`. Keep the Go toolchain aligned with the module's declared version so the check does not create toolchain-only churn.

**Incorrect:**

```yaml
script:
  - go test ./...
```

**Correct:**

```yaml
script:
  - go mod tidy
  - git diff --exit-code -- go.mod go.sum
```

**How to check:** inspect the module's CI job and verify a tidy diff causes the job to fail.
