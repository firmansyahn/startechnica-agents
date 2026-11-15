---
name: go-code-style
description: "Use when writing or reviewing everyday Go code style in a server: the Uber Go Style Guide as the team applies it (formatting, import groups, naming, early returns, struct literals by field name, nil slices, enums from iota+1), time.Time and time.Duration or the unit in the name, JSON tags on every marshaled field, logging through the injected structured logger, structs and interfaces, doc comments, golangci-lint and nolint, moving to newer Go features. Absorbs samber/cc-skills-golang@golang-code-style, adapted to the team (no samber/lo or mo, no new linter config as a side effect), and golang-naming, golang-structs-interfaces, golang-documentation, golang-lint and golang-modernize as its references; go-observability holds logging in depth. Holds the style-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# Go code style (team)

**Principle:** Code reads the same everywhere: the Uber style as the team applies it, explicit types for time and units, a tag on every marshaled field, and logs through the injected logger.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-code-style` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's rules and decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. It also absorbs `samber/cc-skills-golang@golang-naming`, `samber/cc-skills-golang@golang-structs-interfaces`, `samber/cc-skills-golang@golang-documentation`, `samber/cc-skills-golang@golang-lint`, `samber/cc-skills-golang@golang-modernize`: each is a reference of this skill, listed at the start of "In depth", and this skill wins where they differ. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

The style source is the **Uber Go Style Guide** (`github.com/uber-go/guide/blob/master/style.md`), binding unless the project says otherwise; [references/uber-style.md](references/uber-style.md) marks each of its rules must, should or skip for a server. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over all of it.

Related: [go-error-handling](../go-error-handling/SKILL.md) (error style), [go-concurrency](../go-concurrency/SKILL.md) (mutexes, channels), [go-project-layout](../go-project-layout/SKILL.md) (package names and where they go), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Writing or reviewing any Go code, for the style a reviewer will ask about
- Naming a package, type, function or error
- Adding a logger call, a JSON or YAML struct, a duration or a timestamp
- Lint findings, `nolint`, or a newer Go feature to adopt

## The team's rules

**Formatting and naming**
- `gofmt`/`goimports`; two import groups: stdlib, then everything else (the module's own packages included).
- Package names: short, lower-case, singular, no underscores, named for what they provide (`customer`, `notify`, `billing`). Don't stutter: `customer.Store`, not `customer.CustomerStore`.
- Early returns over nesting; no `else` after `return`; soft line limit around 99 columns.
- Group functions by receiver, constructor right after the type, plain helpers last.

**Types and data**
- Field names in struct literals; `json:"..."` tags on every marshaled field (the tag is the contract).
- `time.Time` for instants, `time.Duration` for periods; when a wire format forces an int, put the unit in the name (`TimeoutSec`). Store timestamps in UTC.
- `nil` is the empty slice; test with `len(s) == 0`. A JSON reply that must be `[]`, not `null`, makes the empty slice explicitly. Preallocate (`make([]T, 0, n)`) on hot paths.
- Enums start at `iota + 1` unless zero is the deliberate default.
- Don't embed types in exported structs; copy slices and maps received or returned across a boundary when the callee keeps them.

**Logging**
- Log through the injected `*zap.Logger` (the team logs with zap, not slog) with typed fields (`zap.String`, `zap.Error`) and a constant message, using the project's field naming scheme if it ships logs in one (ECS, OpenTelemetry). No `zap.L()`, `zap.S()` or `SugaredLogger` in library code. A project whose `AGENTS.md` settles on another logger keeps it.
- No new `log.Printf` in a project that has moved to a structured logger. Never log secrets (`sec-no-secrets-in-logs`).

## Team decisions

1. **No `samber/lo`, `samber/mo` or other `samber/*` helper libraries**, whatever upstream recommends: standard library `slices`, `maps` and plain loops.
2. **Linter config:** [references/lint.md](references/lint.md)'s `assets/lint/.golangci.yml` is a starting point to propose, not to add to a project as a side effect. The linters worth enabling, when a project has none: `errcheck`, `govet`, `staticcheck`, `errorlint`, `gosec`, `bodyclose`, `noctx`, `sqlclosecheck`, `rowserrcheck`, `contextcheck`, `gochecknoinits`, `musttag`; they turn most `scan (candidates)` checks in the go-<topic> skills into exact lint findings. Upstream's config in `assets/lint/.golangci.yml` lacks `contextcheck` and `musttag` and disables `gochecknoinits`: add them when proposing it.
3. **Modernizing:** `go.mod` (`go` and `toolchain` lines) decides which features are available; modernize in its own change, not inside an unrelated one.
4. **zap, not slog:** upstream's `log/slog` examples are written with zap; building the logger (ECS json, the `logging` block) is in [go-observability](../go-observability/SKILL.md).
5. **Metrics, tracing and profiling** (Prometheus, OpenTelemetry, Pyroscope) only where the project already has them; otherwise suggest, don't add.
6. **CI is GitLab CI** (`gitlab-ci`) and **tests use the standard `testing` package**: the lint and modernize references assume both, and `sloglint`/`testifylint` only flag leftovers of slog and testify.
7. Links to upstream skills that aren't absorbed (`golang-samber-*`, `golang-uber-*`, `golang-popular-libraries`, `golang-gopls`, `golang-continuous-integration`, `golang-cli`, `golang-pkg-go-dev`) are skipped.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [style-json-tags](rules/style-json-tags.md) | Tag every marshaled field | MEDIUM | lint (musttag), review |
| [style-structured-logger](rules/style-structured-logger.md) | Log through the injected structured logger | LOW | scan |
| [style-time-types](rules/style-time-types.md) | Use time.Duration and time.Time, or put the unit in the name | LOW | scan |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are; a rule that names a linter isn't reported twice.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, not just its title, and against the checklist below.
5. **Report** in the format of `agent-skills-authoring` ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test or linter the project doesn't have.

## Review checklist

- [ ] `gofmt` clean; import groups; package names short and not stuttering
- [ ] Field-named struct literals; JSON tags on marshaled fields
- [ ] `time.Duration`/`time.Time`, or the unit in the name
- [ ] Structured logging through the injected logger, no secrets
- [ ] No new helper library, linter config or metrics stack added as a side effect

## In depth

The material below is `samber/cc-skills-golang@golang-code-style`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's rules and decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: each one the team uses is absorbed into a team skill (`go-how-to`, rule 1, maps the names), and the rest are not adopted.

Also absorbed, one reference each (their own references, assets and evals sit in a folder of the same name):

- [references/naming.md](references/naming.md) (`golang-naming`): names of packages, types, functions, constants, errors, receivers, tests
- [references/structs-interfaces.md](references/structs-interfaces.md) (`golang-structs-interfaces`): composition, embedding, interfaces, type assertions, field tags, receivers
- [references/documentation.md](references/documentation.md) (`golang-documentation`): doc comments, README, CHANGELOG, examples, API docs
- [references/lint.md](references/lint.md) (`golang-lint`): golangci-lint, its configuration and nolint directives
- [references/modernize.md](references/modernize.md) (`golang-modernize`): newer language features and standard library replacements

**Orchestration mode:** Fan out the sub-agents described in the "Parallelizing Code Style Reviews" section, each covering an independent style concern, when reviewing code style across a large codebase, and merge their findings. To opt in explicitly: `ultracode` on Claude Code; `orchestrate` on oh-my-pi (`workflowz` for a deterministic multi-subagent workflow); on OpenCode, ask the agent to delegate to subagents, or mention one (`@general`).

Style rules that require human judgment — linters handle formatting, this skill handles clarity. For naming see [references/naming.md](references/naming.md); for design patterns see `go-project-layout` references/design-patterns.md; for struct/interface design see [references/structs-interfaces.md](references/structs-interfaces.md).

> "Clear is better than clever." — Go Proverbs

When ignoring a rule, add a comment to the code.

### Line Length & Breaking

No rigid line limit: the team's soft limit is around 99 columns, and lines beyond ~120 characters MUST be broken. Break at **semantic boundaries**, not arbitrary column counts. Function calls with 4+ arguments MUST use one argument per line — even when the prompt asks for single-line code:

```go
// Good — each argument on its own line, closing paren separate
mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
    handleUsers(
        w,
        r,
        serviceName,
        cfg,
        logger,
        authMiddleware,
    )
})
```

When a function signature is too long, the real fix is often **fewer parameters** (use an options struct) rather than better line wrapping. For multi-line signatures, put each parameter on its own line.

### Variable Declarations

SHOULD use `:=` for non-zero values, `var` for zero-value initialization. The form signals intent: `var` means "this starts at zero."

```go
var count int              // zero value, set later
name := "default"          // non-zero, := is appropriate
var buf bytes.Buffer       // zero value is ready to use
```

#### Slice & Map Initialization

`nil` is the empty slice (team): a nil slice is ready to `append` to and `range` over, and emptiness is tested with `len(s) == 0`, never `s == nil`. Make the empty slice explicit only where it reaches JSON and must be `[]` rather than `null` (an API reply), because nil slices serialize to `null`, surprising API consumers. Maps that are written to MUST be initialized — nil maps panic on write.

```go
var users []User                        // nil is the empty slice; append and range work
if len(users) == 0 { /* ... */ }        // test emptiness by length, not == nil
resp.Users = []User{}                   // explicit only where JSON must say [] not null
m := map[string]int{}                   // a map you write to must be made
users := make([]User, 0, len(ids))      // preallocate when capacity is known
m := make(map[string]int, len(items))   // preallocate when size is known
```

Do not preallocate speculatively — `make([]T, 0, 1000)` wastes memory when the common case is 10 items.

#### Composite Literals

Composite literals MUST use field names — positional fields break when the type adds or reorders fields:

```go
srv := &http.Server{
    Addr:         ":8080",
    ReadTimeout:  5 * time.Second,
    WriteTimeout: 10 * time.Second,
}
```

### Control Flow

#### Reduce Nesting

Errors and edge cases MUST be handled first (early return). Keep the happy path at minimal indentation:

```go
func process(data []byte) (*Result, error) {
    if len(data) == 0 {
        return nil, errors.New("empty data")
    }

    parsed, err := parse(data)
    if err != nil {
        return nil, fmt.Errorf("parsing: %w", err)
    }

    return transform(parsed), nil
}
```

#### Eliminate Unnecessary `else`

When the `if` body ends with `return`/`break`/`continue`, the `else` MUST be dropped. Use default-then-override for simple assignments — assign a default, then override with independent conditions or a `switch`:

```go
// Good — default-then-override with switch (cleanest for mutually exclusive overrides)
level := zapcore.InfoLevel
switch {
case debug:
    level = zapcore.DebugLevel
case verbose:
    level = zapcore.WarnLevel
}

// Bad — else-if chain hides that there's a default
if debug {
    level = zapcore.DebugLevel
} else if verbose {
    level = zapcore.WarnLevel
} else {
    level = zapcore.InfoLevel
}
```

#### Complex Conditions & Init Scope

When an `if` condition has 3+ operands, MUST extract into named booleans — a wall of `||` is unreadable and hides business logic. Keep expensive checks inline for short-circuit benefit. [Details](./references/details.md)

```go
// Good — named booleans make intent clear
isAdmin := user.Role == RoleAdmin
isOwner := resource.OwnerID == user.ID
isPublicVerified := resource.IsPublic && user.IsVerified
if isAdmin || isOwner || isPublicVerified || permissions.Contains(PermOverride) {
    allow()
}
```

Scope variables to `if` blocks when only needed for the check:

```go
if err := validate(input); err != nil {
    return err
}
```

#### Switch Over If-Else Chains

When comparing the same variable multiple times, prefer `switch`:

```go
switch status {
case StatusActive:
    activate()
case StatusInactive:
    deactivate()
default:
    panic(fmt.Sprintf("unexpected status: %d", status))
}
```

### Function Design

- Functions SHOULD be **short and focused** — one function, one job.
- Functions SHOULD have **≤4 parameters**. Beyond that, use an options struct (see `go-project-layout` references/design-patterns.md).
- **Parameter order**: `context.Context` first, then inputs, then output destinations.
- Naked returns help in very short functions (1-3 lines) where return values are obvious, but become confusing when readers must scroll to find what's returned — name returns explicitly in longer functions.

```go
func FetchUser(ctx context.Context, id string) (*User, error)
func SendEmail(ctx context.Context, msg EmailMessage) error  // grouped into struct
```

#### Prefer `range` for Iteration

SHOULD use `range` over index-based loops. Use `range n` (Go 1.22+) for simple counting.

```go
for _, user := range users {
    process(user)
}
```

### Value vs Pointer Arguments

Pass small types (`string`, `int`, `bool`, `time.Time`) by value. Use pointers when mutating, for large structs (~128+ bytes), or when nil is meaningful. [Details](./references/details.md)

### Code Organization Within Files

- **Group related declarations**: type, constructor, methods together
- **Order**: package doc, imports, constants, types, constructors, methods, helpers
- **One primary type per file** when it has significant methods
- **Blank imports** (`_ "pkg"`) register side effects (init functions). Restricting them to `main` and test packages makes side effects visible at the application root, not hidden in library code
- **Dot imports** pollute the namespace and make it impossible to tell where a name comes from — never use in library code
- **Unexport aggressively** — you can always export later; unexporting is a breaking change. To unexport safely, use a type-aware rename (gopls's rename, or the project's code-intelligence rename tool) — it updates every call site atomically and refuses the change when lowercasing a method would break interface satisfaction, a breakage grep/sed silently ships.

### String Handling

Use `strconv` for simple conversions (faster), `fmt.Sprintf` for complex formatting. Use `%q` in error messages to make string boundaries visible. Use `strings.Builder` for loops, `+` for simple concatenation.

### Type Conversions

Prefer explicit, narrow conversions. Use generics over `any` when a concrete type will do:

```go
func Contains[T comparable](slice []T, target T) bool  // not []any
```

### Philosophy

- **"A little copying is better than a little dependency"**
- **Use `slices` and `maps` standard packages**, iterators and plain loops; for filter/group-by/chunk, write the loop (no `samber/lo` or other helper library)
- **"Reflection is never clear"** — avoid `reflect` unless necessary
- **Don't abstract prematurely** — extract when the pattern is stable
- **Minimize public surface** — every exported name is a commitment

### Parallelizing Code Style Reviews

When reviewing code style across a large codebase, use up to 5 parallel sub-agents, each targeting an independent style concern (e.g. control flow, function design, variable declarations, string handling, code organization).

### Enforce with Linters

Many rules are enforced automatically where the project's linter config enables them: `gofmt`, `gofumpt`, `goimports`, `gocritic`, `revive`, `wsl_v5`. Don't add or change a `.golangci.yml` as a side effect; propose it. → See the [references/lint.md](references/lint.md).

### Cross-References

- → See the [references/naming.md](references/naming.md) for identifier naming conventions
- → See the [references/structs-interfaces.md](references/structs-interfaces.md) for pointer vs value receivers, interface design
- → See the `go-project-layout` references/design-patterns.md for functional options, builders, constructors
- → See the [references/lint.md](references/lint.md) for automated formatting enforcement
- → See `go-refactoring` skill for mechanically applying guard-clause conversion, function extraction, and options-struct migration safely across many call sites once a review surfaces violations at scale
