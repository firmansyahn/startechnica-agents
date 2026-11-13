---
title: Audit production dependencies in CI, and write down accepted advisories
impact: LOW
tags: dependencies, audit, ci, yarn
check: scan
---

## Audit production dependencies in CI, and write down accepted advisories

**Impact: LOW** (a known vulnerable dependency ships unnoticed; raise it for framework advisories)

A CI job runs `yarn npm audit --all --recursive --environment production --severity high` on every merge request and fails on findings; it is never "allow failure". An advisory that doesn't apply goes into `.yarnrc.yml` `npmAuditIgnoreAdvisories` with a comment saying why and when to look again.

**Incorrect:**

```yaml
audit:
  script: yarn npm audit
  allow_failure: true
```

```yaml
npmAuditIgnoreAdvisories:
  - "1234567"
```

**Correct:**

```yaml
audit:
  script: node .yarn/releases/yarn-*.cjs npm audit --all --recursive --environment production --severity high
```

```yaml
npmAuditIgnoreAdvisories:
  - "1234567"   # ReDoS in a build-time CLI only; not in the runtime bundle. Review 2027-02.
```

**How to check:** `scripts/scan.sh` flags a CI config with no `npm audit` step, and ignore entries without a comment. Check the flags against the project's Yarn version (`yarn npm audit --help`).
