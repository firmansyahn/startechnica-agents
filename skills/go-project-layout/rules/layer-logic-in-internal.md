---
title: Logic in internal/, thin cmd/, no pkg/ or util packages
impact: LOW
tags: architecture, module-layout, packages
check: scan
---

## Logic in internal/, thin cmd/, no pkg/ or util packages

**Impact: LOW** (logic in `main` can't be tested or reused; `util`/`common` packages grow into dependency hubs that everything imports; `pkg/` signals an export the server never makes)

A server module keeps binaries in `cmd/<binary>/` (flags, config, wiring, signals only) and all logic in `internal/`. No `pkg/`, `src/` or nested `go.mod`, and no package named `util`, `utils`, `common`, `shared`, `lib`, `helpers`, `base`, `misc` or `types`: name packages for what they provide.

**Incorrect:**

```
pkg/utils/strings.go
internal/common/time.go
cmd/server/main.go        400 lines: handlers, SQL and business rules
```

**Correct:**

```
internal/textnorm/normalize.go
internal/clock/clock.go
internal/app/app.go       wiring
cmd/server/main.go        flags, run(), exit
```

**How to check:** `scripts/scan.sh` reports a `pkg/` or `src/` folder, nested `go.mod` files, util-style package directories, and `cmd/` files over 300 lines.
