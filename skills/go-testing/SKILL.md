---
name: go-testing
description: "Use when writing, fixing, speeding up or reviewing tests in a Go server: table tests (tests, tt, give/want, t.Run), database tests against a real PostgreSQL with one fresh database per test, HTTP handler tests with httptest, -race and t.Parallel, waiting on signals instead of time.Sleep, proving goroutines exit, flaky or slow tests. Absorbs samber/cc-skills-golang@golang-testing, adapted to the team; the vendored `go-performance` references/benchmark.md stays the depth for benchmarks, and this skill wins where they differ. Holds the test-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.1.1"
---

# Go tests (team)

**Principle:** Tests are executable specifications: table-driven, run with the race detector, waiting on signals rather than time, and against a real database where the code talks to one.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-testing` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's rules and decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. For depth on the neighbouring topics read the vendored [`go-performance` references/benchmark.md](../go-performance/references/benchmark.md); this skill wins where they differ. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-database](../go-database/SKILL.md), [go-concurrency](../go-concurrency/SKILL.md), `gitlab-ci` (tests run automatically and block the merge, made fast by sharding and `t.Parallel`: its references/fast-tests.md), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Writing a unit, database or HTTP handler test
- A flaky, slow or hanging test; a test that fails only in CI or under `-race`
- Making a package's tests parallel
- Reviewing a Go diff's tests

## The team's rules

- `<file>_test.go` beside the code; `package x_test` for black-box tests.
- **Table tests:** slice `tests`, case `tt`, fields `give...`/`want...`, run with `t.Run(tt.name, ...)`. Split a table once it grows conditional branches (`shouldCallX`, setup funcs in the table).
- `t.Fatal`/`t.Fatalf` on setup failure, never `panic`. `t.Context()` (Go 1.24+) for contexts that end with the test.
- **Database tests run against real PostgreSQL**, not mocks: a test helper package (`database/dbtest`) gives each test a fresh database or schema (`db := dbtest.Open(t)`), from a DSN in an env var in CI or a throwaway local server. Don't share one database between `t.Parallel()` tests.
- **`-race` in CI**; a test that calls `t.Parallel()` owns everything it touches: its own database, no package globals, no `t.Setenv`.
- **Wait on signals, never `time.Sleep`:** a channel, a `sync.WaitGroup`, or polling a condition with a deadline.
- **A package that starts goroutines** gets a test that stops them and proves they exited.
- **HTTP handlers:** `httptest.NewRecorder` / `httptest.NewServer`, asserting on status, headers and body ([go-http-handlers](../go-http-handlers/SKILL.md)).
- **Big suites:** `go test -timeout 30m`; a timed-out run can leave test database servers behind.

## Team decisions

1. **No testify.** Tests use the standard library `testing` package. Read golang-testing's testify sections as not adopted; don't add `testify` or its linters.
2. **No mocked database.** `go-sqlmock` is not adopted (`test-real-database`); testcontainers is fine where the project already uses it.
3. **Mocks are hand-written fakes** of the small interfaces a consumer declares; no mock generator added as a side effect.
4. Links to upstream skills that aren't absorbed (`golang-stretchr-testify`, `golang-continuous-integration`) are skipped; CI is GitLab CI (`gitlab-ci`).

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [test-no-sleep](rules/test-no-sleep.md) | Wait on signals in tests, never on time.Sleep | MEDIUM | scan |
| [test-race-and-parallel](rules/test-race-and-parallel.md) | Run tests with -race; parallel tests share nothing | MEDIUM | test (CI) |
| [test-real-database](rules/test-real-database.md) | Test database code against a real database, one per test | MEDIUM | review |
| [test-table-driven](rules/test-table-driven.md) | Write table tests with tt, give/want and t.Run | LOW | review |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are; a rule that names a linter isn't reported twice.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, not just its title, and against the checklist below.
5. **Report** in the format of `agent-skills-authoring` ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test or linter the project doesn't have.

## Review checklist

- [ ] Table tests with `tests`/`tt`/`give`/`want` and `t.Run`
- [ ] Database code tested against a real database, one per test
- [ ] No `time.Sleep` waits; parallel tests share nothing
- [ ] Goroutine-starting packages prove their goroutines exit
- [ ] No testify, sqlmock or mock generator added

## In depth

The material below is `samber/cc-skills-golang@golang-testing`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's rules and decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: each one the team uses is absorbed into a team skill (`go-how-to`, rule 1, maps the names), and the rest are not adopted.

**Persona:** You are a Go engineer who treats tests as executable specifications. You write tests to constrain behavior, not to hit coverage targets.

**Thinking mode:** Reason as thoroughly as possible for test strategy design and failure analysis — shallow reasoning misses edge cases and produces brittle tests that pass today but break tomorrow. To ask for it explicitly: `ultrathink` in the prompt on Claude Code and oh-my-pi; the `max` model variant on OpenCode (`ctrl+t` cycles variants, `opencode run --variant max` for one run); `high` reasoning effort or above on Codex (`/model`, or `-c model_reasoning_effort=high`).

**Orchestration mode:** Fan out the three sub-agents described in Audit mode (unit quality and coverage gaps, database test isolation, goroutine/race issues) for auditing a large test suite, and merge their findings into one gap report. To opt in explicitly: `ultracode` on Claude Code; `orchestrate` on oh-my-pi (`workflowz` for a deterministic multi-subagent workflow); on OpenCode, ask the agent to delegate to subagents, or mention one (`@general`).

**Modes:**

- **Write mode** — generating new tests for existing or new code. Work sequentially through the code under test; use `gotests` to scaffold table-driven tests, then enrich with edge cases and error paths.
- **Review mode** — reviewing a PR's test changes. Focus on the diff: check coverage of new behaviour, assertion quality, table-driven structure, and absence of flakiness patterns. Sequential.
- **Audit mode** — auditing an existing test suite for gaps, flakiness, or bad patterns (order-dependent tests, missing `t.Parallel()`, implementation-detail coupling). Launch up to 3 parallel sub-agents split by concern: (1) unit test quality and coverage gaps, (2) database test isolation (a fresh database per test, nothing shared between parallel tests), (3) goroutine leaks and race conditions.
- **Debug mode** — a test is failing or flaky. Work sequentially: reproduce reliably, isolate the failing assertion, trace the root cause in production code or test setup.

**Dependencies:**

- gotests: `go install github.com/cweill/gotests/gotests@latest`

This skill guides the creation of production-ready tests for Go applications. Follow these principles to write maintainable, fast, and reliable tests.

### Best Practices Summary

1. Table-driven tests MUST use named subtests -- every test case needs a `name` field passed to `t.Run`
2. Database tests MUST run against a real PostgreSQL with one fresh database per test (`db := dbtest.Open(t)`), and run in plain `go test ./...` -- no `//go:build integration` gate by default
3. Tests MUST NOT depend on execution order -- each test MUST be independently runnable
4. Independent tests SHOULD use `t.Parallel()` when possible
5. Tests MUST assert observable behavior and public API contracts, not implementation details -- a test coupled to internals turns every refactor into a test rewrite while proving nothing about the contract
6. Packages that start goroutines SHOULD have a test that stops them and proves they exited; `goleak.VerifyTestMain` only where the project already uses goleak
7. Use the standard library `testing` package only -- no testify (`assert`, `require`, `mock`, `suite`)
8. Mock interfaces, not concrete types, with hand-written fakes -- no mock generator
9. Keep unit tests fast (< 1ms); keep database tests fast with a fresh database per test rather than hiding them behind build tags
10. Run tests with race detection in CI
11. Include examples as executable documentation
12. Test files MUST be named after the source file under test, not after the function or method being tested
13. Test functions SHOULD appear in the same order as the functions/methods they test in the source file

### Test Structure and Organization

#### File Conventions

```go
// package_test.go - tests in same package (white-box, access unexported)
package mypackage

// mypackage_test.go - tests in test package (black-box, public API only)
package mypackage_test
```

Name the test file after the source file it tests, not after the function or method under test. Go's convention is one test file per source file (`foo.go` -> `foo_test.go`), because tools (`go test`, coverage reports, IDE "jump to test" navigation, `gotests`) and reviewers all resolve tests by source file, not by symbol. A source file usually declares several functions/methods; splitting its tests by symbol name scatters them across many files and breaks that file-to-file mapping.

```
// ✓ Good — one test file per source file
helloworld.go       -> helloworld_test.go   // contains TestHelloWorld, TestAbcd, TestXyz, ...

// ✗ Bad — test file named after the function/method instead of the source file
helloworld.go       -> abcd_test.go         // wrong: should be helloworld_test.go
```

Exception: very large source files MAY be split into multiple `_test.go` files by concern (e.g. `foo_test.go` + `foo_edgecases_test.go`), but each split file's name MUST still be derived from the source file name, never from an individual function name. Prefer keeping a single `_test.go` file per source file even when it grows large — splitting adds navigation overhead and is rarely worth it; reach for the exception only when a single file becomes genuinely unwieldy to browse or review.

Within a test file, order test functions to match the order their tested functions/methods appear in the source file. A reader (human or agent) scrolling `foo.go` alongside `foo_test.go` can then find the matching test by position instead of searching; drift between the two orderings compounds every time either file grows.

#### Naming Conventions

```go
func TestAdd(t *testing.T) { ... }               // function test
func TestMyStruct_MyMethod(t *testing.T) { ... } // method test
func BenchmarkAdd(b *testing.B) { ... }          // benchmark
func ExampleAdd() { ... }                        // example
func FuzzAdd(f *testing.F) { ... }               // fuzz test
```

### Table-Driven Tests

Table-driven tests are the idiomatic Go way to test multiple scenarios. Always name each test case.

```go
func TestCalculatePrice(t *testing.T) {
    tests := []struct {
        name     string
        quantity int
        unitPrice float64
        expected  float64
    }{
        {
            name:      "single item",
            quantity:  1,
            unitPrice: 10.0,
            expected:  10.0,
        },
        {
            name:      "bulk discount - 100 items",
            quantity:  100,
            unitPrice: 10.0,
            expected:  900.0, // 10% discount
        },
        {
            name:      "zero quantity",
            quantity:  0,
            unitPrice: 10.0,
            expected:  0.0,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := CalculatePrice(tt.quantity, tt.unitPrice)
            if got != tt.expected {
                t.Errorf("CalculatePrice(%d, %.2f) = %.2f, want %.2f",
                    tt.quantity, tt.unitPrice, got, tt.expected)
            }
        })
    }
}
```

### Unit Tests

Unit tests should be fast (< 1ms), isolated (no external dependencies), and deterministic.

### Testing HTTP Handlers

Use `httptest` for handler tests with table-driven patterns. See [HTTP Testing](./references/http-testing.md) for examples with request/response bodies, query parameters, headers, and status code assertions.

### Proving Goroutines Exit

A package that starts goroutines gets a test that starts them, stops them, and waits for the stop to return within a deadline. A `Stop()` that returns while a worker is still running, or never returns, fails the test:

```go
func TestPool_StopWaitsForWorkers(t *testing.T) {
    p := workerpool.New()
    p.Start(4)

    var ran atomic.Int32
    for range 10 {
        p.Submit(func() { ran.Add(1) })
    }

    stopped := make(chan struct{})
    go func() {
        p.Stop() // must return only after every worker has exited
        close(stopped)
    }()

    select {
    case <-stopped:
    case <-time.After(5 * time.Second):
        t.Fatal("Stop did not return: a worker goroutine is still running")
    }
    if got := ran.Load(); got != 10 {
        t.Errorf("tasks run = %d, want 10", got)
    }
}
```

The wait is on a signal (`stopped`), not a sleep; the `time.After` is only the deadline for a hang. Under `testing/synctest` (below), `synctest.Test` waits for every goroutine in the bubble to exit and fails the test when they are left deadlocked, which catches the same leak.

#### goleak, where the project already uses it

If the project already depends on `go.uber.org/goleak`, keep using it to catch leaks across a package; don't add it as a side effect:

```go
import (
    "testing"
    "go.uber.org/goleak"
)

func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m)
}
```

To exclude specific goroutine stacks (for known leaks or library goroutines):

```go
func TestMain(m *testing.M) {
    goleak.VerifyTestMain(m,
        goleak.IgnoreCurrent(),
    )
}
```

Or per-test:

```go
func TestWorkerPool(t *testing.T) {
    defer goleak.VerifyNone(t)
    // ... test code ...
}
```

### testing/synctest for Deterministic Goroutine Testing

`testing/synctest` (Go 1.25+) provides deterministic tests for goroutines, timers, deadlines, and context cancellation. Time advances only when all goroutines are blocked, making ordering predictable.

When to use `synctest` instead of real time:

- Testing concurrent code with time-based operations (time.Sleep, time.After, time.Ticker)
- When race conditions need to be reproducible
- When tests are flaky due to timing issues

```go
import (
    "context"
    "testing"
    "testing/synctest"
    "time"
)

func TestContextTimeout(t *testing.T) {
    synctest.Test(t, func(t *testing.T) {
        const timeout = 5 * time.Second

        ctx, cancel := context.WithTimeout(t.Context(), timeout)
        defer cancel()

        time.Sleep(timeout - time.Nanosecond)
        synctest.Wait()
        if err := ctx.Err(); err != nil {
            t.Fatalf("before timeout: %v", err)
        }

        time.Sleep(time.Nanosecond)
        synctest.Wait()
        if err := ctx.Err(); err != context.DeadlineExceeded {
            t.Fatalf("after timeout: got %v, want DeadlineExceeded", err)
        }
    })
}
```

Use `synctest.Test` in Go 1.25+ and later. Do not use the old Go 1.24 experimental `synctest.Run` API in Go 1.25+ code. If a module explicitly targets Go 1.24 and opts into `GOEXPERIMENT=synctest`, use the old API only as a compatibility fallback.

Key differences in `synctest`:

- `time.Sleep` advances synthetic time instantly when the goroutine blocks
- `time.After` fires when synthetic time reaches the duration
- All goroutines run to blocking points before time advances
- Test execution is deterministic and repeatable
- Go 1.27+ adds `synctest.Sleep(d)` as a direct helper to advance the bubble's fake clock, equivalent to `time.Sleep(d)` followed by `synctest.Wait()` but without needing a real goroutine to block on

Go 1.27+ also adds `httptest.NewTestServer()`, an in-memory fake-network variant of `httptest.NewServer` that composes with `synctest` — no real socket, so server tests can run inside a `synctest.Test` bubble instead of needing `httptest.NewServer` plus real timers.

### Test Timeouts

For tests that may hang, use a timeout helper that panics with caller location. See [Helpers](./references/helpers.md).

### Benchmarks

Write benchmarks as sub-benchmarks (`b.Run` per variant) so each variant gets its own name in the output — that name is what comparison tooling diffs. For Go 1.24+, use `b.Loop()` rather than a `b.N` loop.

→ See [Benchmarks in a Test Suite](./references/benchmarks.md) for the code shape and size-parameterized examples.

→ See `go-performance` references/benchmark.md for measurement methodology: `benchstat`, profiling from benchmarks, and CI regression detection.

### Go 1.26+: test artifacts

When a test, benchmark, or fuzz target needs to persist files for inspection, use `ArtifactDir()` instead of ad-hoc paths or repo-local output.

```go
func TestRenderGoldenArtifact(t *testing.T) {
    dir := t.ArtifactDir()

    out := filepath.Join(dir, "rendered.json")
    if err := os.WriteFile(out, renderedBytes, 0o644); err != nil {
        t.Fatal(err)
    }

    t.Logf("artifact written: %s", out)
}
```

Available on `*testing.T`, `*testing.B`, and `*testing.F` in Go 1.26+.

#### Go 1.27+: `stdversion` runs automatically

`go test` now invokes the `stdversion` vet check by default, flagging any use of an API newer than the module's `go` directive. A CI failure from this check means either the `go` directive needs bumping or the code needs to stop using the newer API — it is not a check to silence.

### Parallel Tests

Use `t.Parallel()` to run tests concurrently:

```go
func TestParallelOperations(t *testing.T) {
    tests := []struct {
        name string
        data []byte
    }{
        {"small data", make([]byte, 1024)},
        {"medium data", make([]byte, 1024*1024)},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()

            result := Process(tt.data)
            if result == nil {
                t.Fatalf("Process(%d bytes) = nil, want a result", len(tt.data))
            }
        })
    }
}
```

### Fuzzing

Use fuzzing to find edge cases and bugs:

```go
func FuzzReverse(f *testing.F) {
    f.Add("hello")
    f.Add("")
    f.Add("a")

    f.Fuzz(func(t *testing.T, input string) {
        reversed := Reverse(input)
        doubleReversed := Reverse(reversed)
        if input != doubleReversed {
            t.Errorf("Reverse(Reverse(%q)) = %q, want %q", input, doubleReversed, input)
        }
    })
}
```

### Examples as Documentation

`ExampleXxx` functions are executable documentation: `go test` compares their stdout to the `// Output:` comment, so a drifting example fails the build instead of misleading readers.

→ See [Examples as Documentation](./references/examples.md) for naming rules, `Unordered output`, and placement.

### Code Coverage

Generate a profile with `go test -coverprofile=coverage.out ./...`, then read the uncovered lines with `go tool cover -html=coverage.out`. Coverage locates untested paths; it does not measure assertion quality, so treat a percentage as a gap finder rather than a target.

→ See [Code Coverage](./references/coverage.md) for coverage modes, `-coverpkg`, and reporting pitfalls.

### Database Tests

Database code is tested against a real PostgreSQL, never a mocked driver (`test-real-database`). A test helper package (`database/dbtest`) gives each test its own fresh, migrated database or schema and drops it on cleanup; the server comes from a DSN in an env var in CI, or a throwaway local server. These tests run in plain `go test ./...` with no build tag, so they block the merge like every other test:

```go
package store_test

func TestOrderRepository_Create(t *testing.T) {
    t.Parallel()
    db := dbtest.Open(t) // fresh, migrated, dropped on cleanup

    repo := store.NewOrderRepository(db)
    order := &store.Order{UserID: "u1", Amount: 100}
    if err := repo.Create(t.Context(), order); err != nil {
        t.Fatalf("Create: %v", err)
    }

    got, err := repo.GetByID(t.Context(), order.ID)
    if err != nil {
        t.Fatalf("GetByID: %v", err)
    }
    if got.Amount != 100 {
        t.Errorf("Amount = %v, want 100", got.Amount)
    }
}
```

Because each test owns its database, tests can call `t.Parallel()` and need no shared setup, truncation or teardown order. testcontainers is fine where a project already uses it to provide the server.

For the helper, schema and data fixtures, see [Integration Testing](./references/integration-testing.md).

### Mocking

Mock interfaces, not concrete types. Define interfaces where consumed, then write small hand-written fakes that implement them; don't add a mock generator.

For mock patterns, test fixtures, and time mocking, see [Mocking](./references/mocking.md).

### Enforce with Linters

Many test best practices are enforced automatically by linters: `thelper`, `paralleltest`. See the `go-code-style` references/lint.md for configuration and usage (`testifylint` doesn't apply: the team doesn't use testify).

### Cross-References

- → See `go-database` skill (testing.md) for database test patterns
- → See `go-concurrency` skill for proving goroutines exit (goleak only where the project already uses it)
- → See `go-code-style` references/lint.md for paralleltest and thelper configuration

### Quick Reference

```bash
go test ./...                          # all tests
go test -run TestName ./...            # specific test by exact name
go test -run TestName/subtest ./...    # subtests within a test
go test -run 'Test(Add|Sub)' ./...     # multiple tests (regexp OR)
go test -run 'Test[A-Z]' ./...         # tests starting with capital letter
go test -run 'TestUser.*' ./...        # tests matching prefix
go test -run '.*Validation.*' ./...    # tests containing substring
go test -run TestName/. ./...          # all subtests of TestName
go test -run '/(unit|integration)' ./... # filter by subtest name
go test -race ./...                    # race detection
go test -cover ./...                   # coverage summary
go test -bench=. -benchmem ./...       # benchmarks
go test -fuzz=FuzzName ./...           # fuzzing
go test -timeout 30m ./...             # big suites, database tests included
```
