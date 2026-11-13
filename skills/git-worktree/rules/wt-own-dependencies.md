---
title: Give each worktree its own dependencies
impact: HIGH
tags: worktree, dependencies, node_modules, go-modules, symlink
check: hook, review
---

## Give each worktree its own dependencies

**Impact: HIGH** (an install or build in the worktree changes another checkout that another session is running; the worktree builds and tests against the other checkout's code and versions instead of its own)

Every worktree resolves its dependencies from its own manifest and lockfile, installed in it before anything runs there. Never point it at another checkout's copy, not even "just to run the tests":

| Ecosystem | Do, in the worktree | Never |
|---|---|---|
| Node | `yarn install --immutable` in each app folder: the worktree gets its own `node_modules`. Yarn's global cache keeps it quick | A symlink (`ln -s`) or junction (`mklink /J`) from the worktree's `node_modules` to another checkout's |
| Go | `go mod download` in the module folder; build and test with the worktree's own `go.mod` and `go.sum`. The module cache (`GOMODCACHE`) and build cache (`GOCACHE`) are shared by design and safe: they're keyed by content, and the module cache is read-only | A symlinked `vendor/`; a `replace` directive or `go.work` that points at another checkout's path (`replace <module> => ../../<repo>/<module>`); tools installed from another checkout. Pin tools with the `tool` directive in `go.mod` and run them with `go tool <name>` |

**Incorrect:**

```sh
ln -s "$MAIN/node_modules" .worktrees/report/node_modules       # Linux, macOS
MSYS2_ARG_CONV_EXCL='*' cmd /c "mklink /J <worktree>\web\node_modules <main>\web\node_modules"   # Windows
ln -s "$MAIN/api/vendor" .worktrees/report/api/vendor
go work init ./.worktrees/report/api "$MAIN/api"                       # builds against the main checkout's module
```

**Correct:**

```sh
(cd .worktrees/report/web && yarn install --immutable)
(cd .worktrees/report/api && go mod download && go build ./...)
```

**How to check:** `find <worktree> -maxdepth 4 \( -name node_modules -o -name vendor \) -prune -type l` prints nothing; `grep -rn '=> \.\./' <worktree> --include=go.mod` and any `go.work` in the worktree name no path outside it. The `guard-worktree-remove.mjs` hook refuses a removal while a `node_modules` or `vendor` link exists.
