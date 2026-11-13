---
title: Never ignore lockfiles, committed tool releases or the env example
impact: HIGH
tags: lockfiles, reproducibility
check: scan, review
---

## Never ignore lockfiles, committed tool releases or the env example

**Impact: HIGH** (installs stop being reproducible, CI resolves different versions, and the pinned tool release goes missing)

Lockfiles (`yarn.lock`, `package-lock.json`, `pnpm-lock.yaml`, `go.sum`, `Cargo.lock`, `uv.lock`, `poetry.lock`) pin what every machine and CI installs, so they are committed. So are a package manager release the repo pins (`.yarn/releases/`), `.env.example`, `.gitattributes`, and any generated file the project commits on purpose. A broad pattern (`*.lock`, `.yarn/`, `.env*`) must not swallow them.

**Incorrect:**

```gitignore
*.lock
.yarn/
.env*
```

**Correct:**

```gitignore
.yarn/*
!.yarn/releases
.env
.env.*
!.env.example
```

**How to check:** the skill's `scripts/scan.sh` runs `git check-ignore` on the lockfiles, tool releases and env examples found in the tree; in review, a new broad pattern is tried against them with `git check-ignore -v`.
