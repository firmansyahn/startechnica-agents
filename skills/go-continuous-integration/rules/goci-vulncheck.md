---
title: Run govulncheck in Go CI
impact: HIGH
tags: ci, security, dependencies
check: ci, review
---

## Run govulncheck in Go CI

**Impact: HIGH** (known vulnerabilities in reachable code can ship unnoticed)

Run a pinned `govulncheck` version against the Go module in CI. Review and resolve its findings using [go-security](../../go-security/SKILL.md); do not hide findings by disabling the job or replacing reachability analysis with a package-version-only scan.

**Incorrect:**

```yaml
script:
  - go test ./...
```

**Correct:**

```yaml
script:
  - go install golang.org/x/vuln/cmd/govulncheck@v1.1.4
  - govulncheck ./...
```

**How to check:** inspect the merged CI configuration for a `govulncheck` invocation and a pinned tool version.
