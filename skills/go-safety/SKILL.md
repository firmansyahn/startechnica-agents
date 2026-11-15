---
name: go-safety
description: "Use when writing or reviewing Go code for accidental bugs: nil panics (nil maps, nil pointers, typed-nil interfaces), append aliasing a shared backing array, silent integer truncation, float == comparison, defer inside loops, defensive copies of slices and maps, usable zero values and safe type assertions. Use when a program panics on a nil map write or a nil pointer, when reviewing for nil safety, numeric overflow or resource lifecycle, or when designing a type whose zero value must work. Absorbs samber/cc-skills-golang@golang-safety, adapted to the team. Not for concurrent access (go-concurrency), exploitable vulnerabilities (go-security) or debugging a program that already fails (go-troubleshooting)."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Go safety (team)

**Principle:** Assume nothing about nil, capacity or numeric range that the code doesn't check: every map is initialised, every type assertion has its ok, and every narrowing conversion is bounded.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-safety` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-error-handling](../go-error-handling/SKILL.md) (errors, panics and the nil error interface), [go-concurrency](../go-concurrency/SKILL.md) (shared state), [go-data-structures](../go-data-structures/SKILL.md) (slice and map internals), [go-security](../go-security/SKILL.md) (attackers, where this skill covers mistakes), [go-testing](../go-testing/SKILL.md).

## Team decisions

1. **Errors and panics follow `go-error-handling`:** no `panic` in request or worker paths, and errors handled once; the defensive patterns here never swallow an error to avoid a crash.
2. Links to upstream skills that aren't absorbed (`samber/cc-skills-golang@golang-samber-*`, `-uber-*`, `-google-wire`, `-popular-libraries`, `-gopls`, `-pkg-go-dev`, `-continuous-integration` and the rest in `go-how-to` rule 9) are skipped, and so are their install commands.

## In depth

The material below is `samber/cc-skills-golang@golang-safety`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: `go-how-to` (rule 1) maps each to the team skill that absorbed it.

**Persona:** You are a defensive Go engineer. You treat every untested assumption about nil, capacity, and numeric range as a latent crash waiting to happen.

### Go Safety: Correctness & Defensive Coding

Prevents programmer mistakes — bugs, panics, and silent data corruption in normal (non-adversarial) code. Security handles attackers; safety handles ourselves.

#### Best Practices Summary

1. **Prefer generics over `any`** when the type set is known — compiler catches mismatches instead of runtime panics
2. **Always use safe type assertions** — for normal interfaces use comma-ok (`v, ok := x.(T)`); for reflection in Go 1.25+ prefer `reflect.TypeAssert[T](value)` over `value.Interface().(T)`.
3. **Typed nil pointer in an interface is not `== nil`** — the type descriptor makes it non-nil
4. **Writing to a nil map panics** — always initialize before use
5. **`append` may reuse the backing array** — both slices share memory if capacity allows, silently corrupting each other
6. **Return defensive copies** from exported functions — otherwise callers mutate your internals
7. **`defer` runs at function exit, not loop iteration** — extract loop body to a function
8. **Integer conversions truncate silently** — `int64` to `int32` wraps without error
9. **Float arithmetic is not exact** — use epsilon comparison or `math/big`
10. **Design useful zero values** — nil map fields panic on first write; use lazy init
11. **Use `sync.Once` for lazy init** — guarantees exactly-once even under concurrency

#### Nil Safety

Nil-related panics are the most common crash in Go.

##### The nil interface trap

Interfaces store (type, value). An interface is `nil` only when both are nil. Returning a typed nil pointer sets the type descriptor, making it non-nil:

```go
// ✗ Dangerous — interface{type: *MyHandler, value: nil} is not == nil
func getHandler() http.Handler {
    var h *MyHandler // nil pointer
    if !enabled {
        return h // interface{type: *MyHandler, value: nil} != nil
    }
    return h
}

// ✓ Good — return nil explicitly
func getHandler() http.Handler {
    if !enabled {
        return nil // interface{type: nil, value: nil} == nil
    }
    return &MyHandler{}
}
```

##### Nil map, slice, and channel behavior

| Type    | Index into nil | Write to nil   | Len/Cap of nil | Range over nil |
| ------- | -------------- | -------------- | -------------- | -------------- |
| Map     | Zero value     | **panic**      | 0              | 0 iterations   |
| Slice   | **panic**      | **panic**      | 0              | 0 iterations   |
| Channel | Blocks forever | Blocks forever | 0              | Blocks forever |

```go
// ✗ Bad — nil map panics on write
var m map[string]int
m["key"] = 1

// ✓ Good — initialize or lazy-init in methods
m := make(map[string]int)

func (r *Registry) Add(name string, val int) {
    if r.items == nil { r.items = make(map[string]int) }
    r.items[name] = val
}
```

See **[Nil Safety Deep Dive](references/nil-safety.md)** for nil receivers, nil in generics, and nil interface performance.

#### Slice & Map Safety

##### Slice aliasing — the append trap

`append` reuses the backing array if capacity allows. Both slices then share memory:

```go
// ✗ Dangerous — a and b share backing array
a := make([]int, 3, 5)
b := append(a, 4)
b[0] = 99 // also modifies a[0]

// ✓ Good — full slice expression forces new allocation
b := append(a[:len(a):len(a)], 4)
```

##### Map concurrent access

Maps MUST NOT be accessed concurrently — → see `samber/cc-skills-golang@golang-concurrency` for sync primitives.

See **[Slice and Map Deep Dive](references/slice-map-safety.md)** for range pitfalls, subslice memory retention, and `slices.Clone`/`maps.Clone`.

#### Numeric Safety

##### Implicit type conversions truncate silently

```go
// ✗ Bad — silently wraps around if val > math.MaxInt32 (3B becomes -1.29B)
var val int64 = 3_000_000_000
i32 := int32(val) // -1294967296 (silent wraparound)

// ✓ Good — check before converting
if val > math.MaxInt32 || val < math.MinInt32 {
    return fmt.Errorf("value %d overflows int32", val)
}
i32 := int32(val)
```

##### Float comparison

```go
// ✗ Bad — floating point arithmetic is not exact
var a, b, c float64 = 0.1, 0.2, 0.3
a+b == c // false

// ✓ Good — use epsilon comparison
const epsilon = 1e-9
math.Abs((a+b)-c) < epsilon // true
```

##### Division by zero

Integer division by zero panics. Float division by zero produces `+Inf`, `-Inf`, or `NaN`.

```go
func avg(total, count int) (int, error) {
    if count == 0 {
        return 0, errors.New("division by zero")
    }
    return total / count, nil
}
```

For integer overflow as a security vulnerability, see the `samber/cc-skills-golang@golang-security` skill section.

#### Resource Safety

##### defer in loops — resource accumulation

`defer` runs at _function_ exit, not loop iteration. Resources accumulate until the function returns:

```go
// ✗ Bad — all files stay open until function returns
for _, path := range paths {
    f, _ := os.Open(path)
    defer f.Close() // deferred until function exits
    process(f)
}

// ✓ Good — extract to function so defer runs per iteration
for _, path := range paths {
    if err := processOne(path); err != nil { return err }
}
func processOne(path string) error {
    f, err := os.Open(path)
    if err != nil { return err }
    defer f.Close()
    return process(f)
}
```

##### Goroutine leaks

→ See `samber/cc-skills-golang@golang-concurrency` for goroutine lifecycle and leak prevention.

#### Immutability & Defensive Copying

Exported functions returning slices/maps SHOULD return defensive copies.

##### Protecting struct internals

```go
// ✗ Bad — exported slice field, anyone can mutate
type Config struct {
    Hosts []string
}

// ✓ Good — unexported field with accessor returning a copy
type Config struct {
    hosts []string
}

func (c *Config) Hosts() []string {
    return slices.Clone(c.hosts)
}
```

#### Initialization Safety

##### Zero-value design

Design types so `var x MyType` is safe — prevents "forgot to initialize" bugs:

```go
var mu sync.Mutex   // ✓ usable at zero value
var buf bytes.Buffer // ✓ usable at zero value

// ✗ Bad — nil map panics on write
type Cache struct { data map[string]any }
```

##### sync.Once for lazy initialization

```go
type DB struct {
    once sync.Once
    conn *sql.DB
    err  error
}

func (db *DB) connection() (*sql.DB, error) {
    db.once.Do(func() {
        db.conn, db.err = sql.Open("postgres", connStr)
    })
    return db.conn, db.err
}
```

##### init() function pitfalls

→ See `samber/cc-skills-golang@golang-design-patterns` for why init() should be avoided in favor of explicit constructors.

#### Enforce with Linters

Many safety pitfalls are caught automatically by linters: `errcheck`, `forcetypeassert`, `nilerr`, `govet`, `staticcheck`. See the `samber/cc-skills-golang@golang-lint` skill for configuration and usage.

##### Go 1.25+ reflection type assertions

For reflection code, prefer `reflect.TypeAssert[T]` over `value.Interface().(T)`.

```go
v := reflect.ValueOf(x)
if s, ok := reflect.TypeAssert[string](v); ok {
    use(s)
}
```

#### Common Mistakes

| Mistake | Fix |
| --- | --- |
| Bare type assertion `v := x.(T)` | Panics on type mismatch, crashing the program. Use `v, ok := x.(T)` to handle gracefully |
| Returning typed nil in interface function | Interface holds (type, nil) which is != nil. Return untyped `nil` for the nil case |
| Writing to a nil map | Nil maps have no backing storage — write panics. Initialize with `make(map[K]V)` or lazy-init |
| Assuming `append` always copies | If capacity allows, both slices share the backing array. Use `s[:len(s):len(s)]` to force a copy |
| `defer` in a loop | `defer` runs at function exit, not loop iteration — resources accumulate. Extract body to a separate function |
| `int64` to `int32` without bounds check | Values wrap silently (3B → -1.29B). Check against `math.MaxInt32`/`math.MinInt32` first |
| Comparing floats with `==` | IEEE 754 representation is not exact (`0.1+0.2 != 0.3`). Use `math.Abs(a-b) < epsilon` |
| Integer division without zero check | Integer division by zero panics. Guard with `if divisor == 0` before dividing |
| Returning internal slice/map reference | Callers can mutate your struct's internals through the shared backing array. Return a defensive copy |
| Multiple `init()` with ordering assumptions | `init()` execution order across files is unspecified. → See `samber/cc-skills-golang@golang-design-patterns` — use explicit constructors |
| Blocking forever on nil channel | Nil channels block on both send and receive. Always initialize before use |

#### Cross-References

- → See `samber/cc-skills-golang@golang-concurrency` skill for concurrent access patterns and sync primitives
- → See `samber/cc-skills-golang@golang-data-structures` skill for slice/map internals, capacity growth, and container/ packages
- → See `samber/cc-skills-golang@golang-error-handling` skill for nil error interface trap
- → See `samber/cc-skills-golang@golang-security` skill for security-relevant safety issues (memory safety, integer overflow)
- → See `samber/cc-skills-golang@golang-troubleshooting` skill for debugging panics and race conditions
