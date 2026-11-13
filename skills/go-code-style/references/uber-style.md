# Uber Go Style Guide, applied to server projects

Source: [uber-go/guide style.md](https://github.com/uber-go/guide/blob/master/style.md). Each rule is marked **must**, **should** or **skip**, with a note on how it applies to a server. The project's own rules win where they differ.

## Guidelines

| Rule | Level | Note |
|---|---|---|
| Pointers to interfaces | must | pass interfaces by value; never `*SomeInterface` |
| Verify interface compliance | should | `var _ http.Handler = (*Server)(nil)` where a type exists to satisfy an interface another package declares |
| Receivers and interfaces | must | be consistent per type; pointer receivers for anything holding a mutex, a DB handle or state |
| Zero-value mutexes | must | `mu sync.Mutex` field; never `new(sync.Mutex)`, never embedded |
| Copy slices/maps at boundaries | must | copy when storing a caller's slice or returning internal state guarded by a lock (caches, rule tables) |
| Defer to clean up | must | `defer rows.Close()`, `defer tx.Rollback()` right after a successful open/begin, `defer mu.Unlock()` |
| Channel size one or none | must | anything bigger needs a comment on what bounds it |
| Start enums at one | should | `iota + 1` unless zero is the meaningful default |
| `time.Time` / `time.Duration` | must | no bare ints for time in Go APIs; wire ints carry the unit in their name; store UTC |
| Error types | must | static + matched: exported `Err...` var; dynamic + matched: `...Error` type; unmatched: `errors.New`/`fmt.Errorf` inline |
| Error wrapping | must | `%w` by default; `%v` to hide a cause deliberately; no "failed to" |
| Error naming | must | `ErrX`/`errX` vars, `XError` types |
| Handle errors once | must | log-and-return is the most common review finding; the HTTP handler is where an error becomes a status plus a log line |
| Type assertion comma-ok | must | including `ctx.Value(...)` lookups |
| Don't panic | must | startup misconfiguration returns an error to `run`; `template.Must`/`regexp.MustCompile` on constants at package level are fine |
| `go.uber.org/atomic` | skip | use stdlib `sync/atomic` typed values (`atomic.Int64`, `atomic.Bool`), which postdate that rule |
| Avoid mutable globals | must | inject; read-only lookup tables are fine |
| No embedding in public structs | must | hand-write the delegating methods |
| Avoid built-in names | must | no `len`, `new`, `error`, `string`, `copy` as identifiers; `go vet` shadow checks help |
| Avoid `init()` | must | deterministic constant setup only; config, env, files, DB, goroutines go through constructors |
| Exit in main / exit once | must | `main` → `run() error`; library code never calls `os.Exit`/`log.Fatal` |
| Field tags on marshaled structs | must | JSON, YAML (config) and form structs all tagged |
| No fire-and-forget goroutines | must | stop signal plus wait; `wg.Go(func(){...})` (Go 1.25+) is fine for fan-out |
| No goroutines in `init()` | must | expose a worker with `Start`/`Stop` |

## Performance (hot paths only: request handling at volume, protocol servers, matching loops, scheduled sweeps)

| Rule | Level |
|---|---|
| `strconv` over `fmt` for primitive conversions | should |
| Don't repeat string→`[]byte` conversions in loops | should |
| Capacity hints for slices and maps | should |

## Style

| Rule | Level | Note |
|---|---|---|
| Line length ~99 soft | should | wrap long SQL in raw string literals |
| Be consistent | must | follow the package you're in; change style per package, not per function |
| Group similar declarations | should | related `const`/`var`/`type` blocks; unrelated ones apart |
| Import groups | must | stdlib, blank line, everything else; `goimports` does it |
| Package names | must | lower-case, singular, no `util`/`common`/`shared`/`lib` |
| Function names | must | MixedCaps; tests may use `TestThing_Case` |
| Import aliasing | must | only when the name differs from the last path element or clashes |
| Function grouping and ordering | should | types, constructor, exported methods, unexported methods, helpers |
| Reduce nesting / unnecessary else | must | guard clauses and `continue` |
| Top-level `var` without redundant type | should | |
| Prefix unexported globals with `_` | skip | rarely used in practice; consistency within the codebase wins. Errors keep the `err` prefix |
| Embedding in structs | must | embedded fields first, then a blank line; never embed mutexes |
| Local declarations | should | `:=` for values, `var s []T` for empty slices, `var x T` for zero structs |
| `nil` is a valid slice | must | return `nil`; check `len`. Exception: a JSON reply that must be `[]`, not `null`, makes the empty slice explicitly |
| Reduce variable scope | should | `if err := f(); err != nil` |
| Naked parameters | should | `/* isLocal */` comments, or better a named type instead of a bare `bool` |
| Raw string literals | should | SQL and JSON fixtures in backticks |
| Struct init by field name | must | positional allowed only in test tables of 3 fields or fewer |
| Omit zero-value fields | should | keep them in test tables when the name adds meaning |
| `var` for zero structs; `&T{}` over `new(T)` | should | |
| Maps: `make` for programmatic, literals for fixed sets | should | |
| Printf format strings as `const`; Printf-style names end in `f` | should | |

## Patterns

**Test tables**: `tests := []struct{ give ...; want ... }`, loop variable `tt`, `t.Run(tt.name, ...)`. Since Go 1.22 the loop variable is per-iteration, so `tt := tt` is unnecessary before `t.Parallel()`. Don't use `t.Parallel()` in tests that share one database; give each parallel test its own.

**Functional options**: for constructors with optional settings or more than about three parameters. Prefer the `Option` interface with an unexported `apply(*options)`. A plain `Deps` struct is fine for a composition-root constructor whose arguments are all required.

## Linting

Uber recommends `errcheck`, `goimports`, `revive`, `govet` and `staticcheck`, run through `golangci-lint`. When the project has a `.golangci.yml`, run it and keep it clean. When it doesn't, run `gofmt -l .` and `go vet ./...` (and `staticcheck ./...` as a useful extra), and suggest a lint config to the user rather than adding one as a side effect of an unrelated change.
