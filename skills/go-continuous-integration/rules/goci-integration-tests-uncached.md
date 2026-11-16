---
title: Disable test-result caching for integration tests
impact: MEDIUM
tags: ci, tests, integration
check: ci, review
---

## Disable test-result caching for integration tests

**Impact: MEDIUM** (a cached result can hide failures or changed behavior in databases and other external services)

Use `-count=1` for integration tests whose behavior depends on external service state that Go cannot observe. This disables test-result caching without disabling the Go build cache.

**Incorrect:**

```yaml
script:
  - go test -race ./...
```

**Correct:**

```yaml
script:
  - go test -race -count=1 ./...
```

**How to check:** inspect the command used for integration tests and confirm `-count=1` is present.
