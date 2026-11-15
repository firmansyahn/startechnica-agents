---
name: go-concurrency
description: "Use when a Go server starts goroutines, runs background workers, passes or creates a context.Context, sets deadlines on outbound calls or queries, guards state with a mutex, sizes a channel, or shuts down; and when reviewing a Go diff for goroutine leaks, lost cancellation or races. Every goroutine has an owner (a stop signal and a wait), contexts flow from the caller, root contexts only at the root, shutdown in reverse order of start. Absorbs samber/cc-skills-golang@golang-concurrency, adapted to the team, and golang-context as its contexts reference. Holds the conc-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# Go concurrency and lifecycle (team)

**Principle:** Every goroutine has an owner, a stop signal and a wait, and every blocking call has a context or a timeout.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-concurrency` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's rules and decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. It also absorbs `samber/cc-skills-golang@golang-context`: each is a reference of this skill, listed at the start of "In depth", and this skill wins where they differ. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-project-layout](../go-project-layout/SKILL.md) (the worker and `main` shapes in its references/module-layout.md), [go-database](../go-database/SKILL.md) (`db-context-on-queries`), [go-testing](../go-testing/SKILL.md) (`test-race-and-parallel`, `test-no-sleep`), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Starting a goroutine, a background worker, a poller or a scheduled job
- Passing a `context.Context`, or deciding where one is created
- An outbound HTTP call, RPC or query that needs a deadline
- A mutex, a channel, or graceful shutdown
- A test hangs, leaks goroutines or fails under `-race`

## The team's rules

- **No goroutine without an owner:** a `context.Context` or stop channel ends it, a `sync.WaitGroup` or done channel waits for it. Workers expose `Start(ctx)`/`Stop()` or `Run(ctx) error` (worker shape: [go-project-layout references/module-layout.md](../go-project-layout/references/module-layout.md)).
- **Contexts flow from the caller.** Pass the request's or worker's `ctx` down; `context.Background()` only at the root (`main`, `internal/app`, a test's `t.Context()`).
- **Every outbound call has a deadline:** a context with a timeout or a client `Timeout`; never an unbounded `http.DefaultClient` call.
- **Shut down in reverse order of start:** stop accepting requests, stop workers, then close the database.
- **`sync.Mutex` is a named zero-value field** (`mu sync.Mutex`), never embedded, never a pointer, never copied.
- **Channels are unbuffered or size one**, unless a comment says what bounds a bigger buffer.

## Team decisions

1. **Lifecycle is hand-wired**, not through a DI container's hooks (`uber-go/fx` and the like are not adopted; [go-project-layout](../go-project-layout/SKILL.md)).
2. **Tests prove goroutines exit** with the package's own stop-and-wait test; `goleak` is fine where the project already has it, not added as a side effect.
3. **The logger is never a context value:** it is injected, and request fields come from `WithTrace(ctx, log)` (`go-observability`).
4. Links to upstream skills that aren't absorbed (`golang-samber-*`) are skipped.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [conc-context-propagation](rules/conc-context-propagation.md) | Pass the caller's context; create root contexts only at the root | HIGH | scan, lint (contextcheck) |
| [conc-goroutine-owner](rules/conc-goroutine-owner.md) | Give every goroutine a stop signal and a wait | HIGH | test, review |
| [conc-outbound-timeouts](rules/conc-outbound-timeouts.md) | Bound every outbound call with a context or client timeout | HIGH | scan, lint (noctx) |
| [conc-channel-size](rules/conc-channel-size.md) | Size channels one or none, or say what bounds them | MEDIUM | scan |
| [conc-mutex-field](rules/conc-mutex-field.md) | Keep mutexes as named zero-value fields, never copied | MEDIUM | vet (copylocks), scan |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are; a rule that names a linter isn't reported twice.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, not just its title, and against the checklist below.
5. **Report** in the format of `agent-skills-authoring` ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test or linter the project doesn't have.

## Review checklist

- [ ] Every `go` statement has a stop signal and a wait
- [ ] Contexts passed from the caller; no `context.Background()` below the root
- [ ] Outbound calls and queries bounded by a deadline
- [ ] Shutdown order: listeners, workers, then the database
- [ ] Mutexes are named value fields; buffered channels say what bounds them

## In depth

The material below is `samber/cc-skills-golang@golang-concurrency`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's rules and decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: each one the team uses is absorbed into a team skill (`go-how-to`, rule 1, maps the names), and the rest are not adopted.

Also absorbed, one reference each (their own references, assets and evals sit in a folder of the same name):

- [references/context.md](references/context.md) (`golang-context`): propagation, cancellation, deadlines, request-scoped values, WithoutCancel

**Persona:** You are a Go concurrency engineer. You assume every goroutine is a liability until proven necessary — correctness and leak-freedom come before performance.

**Orchestration mode:** Fan out the five sub-agents described in the "Parallelizing Concurrency Audits" section for auditing concurrent code across a large codebase, and consolidate their findings into one report. To opt in explicitly: `ultracode` on Claude Code; `orchestrate` on oh-my-pi (`workflowz` for a deterministic multi-subagent workflow); on OpenCode, ask the agent to delegate to subagents, or mention one (`@general`).

**Modes:**

- **Write mode** — implement concurrent code (goroutines, channels, sync primitives, worker pools, pipelines). Follow the sequential instructions below.
- **Review mode** — reviewing a PR's concurrent code changes. Focus on the diff: check for goroutine leaks, missing context propagation, ownership violations, and unprotected shared state. Sequential.
- **Audit mode** — auditing existing concurrent code across a codebase. Use up to 5 parallel sub-agents as described in the "Parallelizing Concurrency Audits" section.

Go's concurrency model is built on goroutines and channels. Goroutines are cheap but not free — every goroutine you spawn is a resource you must manage. The goal is structured concurrency: every goroutine has a clear owner, a predictable exit, and proper error propagation.

### Core Principles

1. **Every goroutine must have a clear exit** — without a shutdown mechanism (context, done channel, WaitGroup), they leak and accumulate until the process crashes
2. **Share memory by communicating** — channels transfer ownership explicitly; mutexes protect shared state but make ownership implicit
3. **Send copies, not pointers** on channels — sending pointers creates invisible shared memory, defeating the purpose of channels
4. **Only the sender closes a channel** — closing from the receiver side panics if the sender writes after close
5. **Specify channel direction** (`chan<-`, `<-chan`) — the compiler prevents misuse at build time
6. **Default to unbuffered channels** — larger buffers mask backpressure; use them only with measured justification
7. **Always include `ctx.Done()` in select** — without it, goroutines leak after caller cancellation
8. **Avoid repeated `time.After` in hot loops** — each call allocates a timer and creates unnecessary churn; use `time.NewTimer` + `Reset` for long-running loops
9. **Prove goroutines exit in tests** — a stop-and-wait test per worker that starts it, cancels it and waits for it to return; `go.uber.org/goleak` only where the project already uses it, not added as a side effect

For detailed channel/select code examples, see [Channels and Select Patterns](references/channels-and-select.md).

### Channel vs Mutex vs Atomic

| Scenario | Use | Why |
| --- | --- | --- |
| Passing data between goroutines | Channel | Communicates ownership transfer |
| Coordinating goroutine lifecycle | Channel + context | Clean shutdown with select |
| Protecting shared struct fields | `sync.Mutex` / `sync.RWMutex` | Simple critical sections |
| Simple counters, flags | `sync/atomic` | Lock-free, lower overhead |
| Many readers, few writers on a map | `sync.Map` | Optimized for read-heavy workloads. **Concurrent map read/write causes a hard crash** |
| Caching expensive computations | `sync.Once` / `singleflight` | Execute once or deduplicate |

### WaitGroup vs errgroup

| Need | Use | Why |
| --- | --- | --- |
| Wait for goroutines, errors not needed | `sync.WaitGroup` | Fire-and-forget |
| Wait + collect first error | `errgroup.Group` | Error propagation |
| Wait + cancel siblings on first error | `errgroup.WithContext` | Context cancellation on error |
| Wait + limit concurrency | `errgroup.SetLimit(n)` | Built-in worker pool |

### Sync Primitives Quick Reference

| Primitive | Use case | Key notes |
| --- | --- | --- |
| `sync.Mutex` | Protect shared state | Keep critical sections short; never hold across I/O |
| `sync.RWMutex` | Many readers, few writers | Never upgrade RLock to Lock (deadlock) |
| `sync/atomic` | Simple counters, flags | Prefer typed atomics (Go 1.19+): `atomic.Int64`, `atomic.Bool` |
| `sync.Map` | Concurrent map, read-heavy | No explicit locking; use `RWMutex`+map when writes dominate |
| `sync.Pool` | Reuse temporary objects | Always `Reset()` before `Put()`; reduces GC pressure |
| `sync.Once` | One-time initialization | Go 1.21+: `OnceFunc`, `OnceValue`, `OnceValues` |
| `sync.WaitGroup` | Waiting for simple goroutines | Go 1.25+: prefer `wg.Go(func(){ ... })` for fire-and-wait tasks that do not panic and do not need error propagation. For Go <1.25 use `Add`/`Done`. For errors/cancellation/limits, use `errgroup` with context. |
| `x/sync/singleflight` | Deduplicate concurrent calls | Cache stampede prevention |
| `x/sync/errgroup` | Goroutine group + errors | `SetLimit(n)` replaces hand-rolled worker pools |

For detailed examples and anti-patterns, see [Sync Primitives Deep Dive](references/sync-primitives.md).

### Concurrency Checklist

Before spawning a goroutine, answer:

- [ ] **How will it exit?** — context cancellation, channel close, or explicit signal
- [ ] **Can I signal it to stop?** — pass `context.Context` or done channel
- [ ] **Can I wait for it?** — `sync.WaitGroup` or `errgroup`
- [ ] **Who owns the channels?** — creator/sender owns and closes
- [ ] **Should this be synchronous instead?** — don't add concurrency without measured need

### Pipelines and Worker Pools

For pipeline patterns (fan-out/fan-in, bounded workers, generator chains, Go 1.23+ iterators, stop-and-wait leak tests), see [Pipelines and Worker Pools](references/pipelines.md).

### Parallelizing Concurrency Audits

When auditing concurrency across a large codebase, use up to 5 parallel sub-agents:

1. Find all goroutine spawns (`go func`, `go method`) and verify shutdown mechanisms
2. Search for mutable globals and shared state without synchronization
3. Audit channel usage — ownership, direction, closure, buffer sizes
4. Find `time.After` in loops, missing `ctx.Done()` in select, unbounded spawning
5. Check mutex usage, `sync.Map`, atomics, and thread-safety documentation

### Common Mistakes

| Mistake | Fix |
| --- | --- |
| Fire-and-forget goroutine | Provide stop mechanism (context, done channel) |
| Closing channel from receiver | Only the sender closes |
| `time.After` in hot loop | Reuse `time.NewTimer` + `Reset` |
| Missing `ctx.Done()` in select | Always select on context to allow cancellation |
| Unbounded goroutine spawning | Use `errgroup.SetLimit(n)` or semaphore |
| Sharing pointer via channel | Send copies or immutable values |
| `wg.Add` inside goroutine | Call `Add` before `go` — `Wait` may return early otherwise |
| Forgetting `-race` in CI | Always run `go test -race ./...` |
| Mutex held across I/O | Keep critical sections short |

### Cross-References

- → See `go-performance` skill for false sharing, cache-line padding, `sync.Pool` hot-path patterns
- → See [references/context.md](references/context.md) for cancellation propagation and timeout patterns
- → See `go-safety` skill for concurrent map access and race condition prevention
- → See `go-troubleshooting` skill for debugging goroutine leaks and deadlocks
- → See `go-project-layout` references/design-patterns.md for graceful shutdown patterns

#### Goroutine leak profile

The goroutine leak profile (experimental behind `GOEXPERIMENT=goroutineleakprofile` in Go 1.26) is generally available in `runtime/pprof` since Go 1.27 — no build flag required. It is a useful production-oriented leak signal alongside the existing tools below.

```bash
curl http://localhost:6060/debug/pprof/goroutineleak?debug=2
go tool pprof http://localhost:6060/debug/pprof/goroutineleak
```

Keep existing tools:

- tests: a stop-and-wait test per worker (cancel, then wait for it to return); `go.uber.org/goleak` where the project already uses it
- runtime count: `runtime.NumGoroutine()`
- stack dump: `/debug/pprof/goroutine?debug=2`
- race checks: `go test -race ./...`

### References

- [Go Concurrency Patterns: Pipelines](https://go.dev/blog/pipelines)
- [Effective Go: Concurrency](https://go.dev/doc/effective_go#concurrency)
