---
name: go-performance
description: "Use when a Go service is slow, allocates too much or holds too much memory, once profiling or a benchmark has found the bottleneck: allocation reduction, CPU efficiency, memory layout, GC tuning (GOGC, GOMEMLIMIT), sync.Pool, caching, hot paths, I/O and connection reuse; and for measuring it: writing and comparing benchmarks (testing.B, b.Loop), benchstat, pprof CPU, heap, block and mutex profiles, execution traces, escape analysis, CI benchmark regressions, Prometheus Go runtime metrics. Also for a performance review of a Go diff. Absorbs samber/cc-skills-golang@golang-performance and golang-benchmark, adapted to the team (measure first, zap in hot paths, profiling set up as go-observability says). Not for a wrong result or a crash (go-troubleshooting)."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.1.4"
---

# Go performance (team)

**Principle:** Never optimize without measuring: profile or benchmark first, change one thing, and compare against the baseline with benchstat.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-performance` and `samber/cc-skills-golang@golang-benchmark` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-testing](../go-testing/SKILL.md) (benchmarks are tests, beside the code), [go-observability](../go-observability/SKILL.md) (runtime metrics, pprof endpoints, continuous profiling), [go-troubleshooting](../go-troubleshooting/SKILL.md) (when the problem is a wrong result, not speed), [go-data-structures](../go-data-structures/SKILL.md), [go-concurrency](../go-concurrency/SKILL.md). Measurement in depth: [references/benchmark.md](references/benchmark.md).

## Team decisions

1. **Logging in hot paths goes through zap** ([go-observability](../go-observability/SKILL.md)): upstream's `slog.LogAttrs` advice becomes zap's typed fields, with `log.Check(level, msg)` guarding a field that is expensive to build.
2. **Profiling endpoints and continuous profiling** are set up as [go-observability](../go-observability/SKILL.md) says: pprof on an internal port, never the public one, and Pyroscope behind a setting.
3. **No `samber/*` libraries** ([go-code-style](../go-code-style/SKILL.md), decision 1): the standard library, and `golang.org/x/sync/singleflight` for request coalescing.
4. **Benchmarks live beside the code** under [go-testing](../go-testing/SKILL.md)'s rules, and CI benchmark checks run in GitLab CI ([gitlab-ci](../gitlab-ci/SKILL.md)), not GitHub Actions.
5. Links to upstream skills that aren't absorbed (`samber/cc-skills-golang@golang-samber-*`, `-uber-*`, `-google-wire`, `-popular-libraries`, `-pkg-go-dev` and the rest in [go-how-to](../go-how-to/SKILL.md) rule 9) are skipped, and so are their install commands.

## In depth

The material below is `samber/cc-skills-golang@golang-performance`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. `golang-benchmark` is in [references/benchmark.md](references/benchmark.md). The team's decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: [go-how-to](../go-how-to/SKILL.md) (rule 1) maps each to the team skill that absorbed it.

**Persona:** You are a Go performance engineer. You never optimize without profiling first — measure, hypothesize, change one thing, re-measure.

**Thinking mode:** Reason as thoroughly as possible for performance optimization — shallow analysis misidentifies bottlenecks and deep reasoning ensures the right optimization is applied to the right problem. To ask for it explicitly: `ultrathink` in the prompt on Claude Code and oh-my-pi; the `max` model variant on OpenCode (`ctrl+t` cycles variants, `opencode run --variant max` for one run); `high` reasoning effort or above on Codex (`/model`, or `-c model_reasoning_effort=high`).

**Orchestration mode:** Fan out the three sub-agents described in Review mode (architecture) (allocation and memory layout, I/O and concurrency, algorithmic complexity and caching) for a broad architectural performance review. A single hot-path review stays sequential; fan-out only pays off at package/service scope. To opt in explicitly: `ultracode` on Claude Code; `orchestrate` on oh-my-pi (`workflowz` for a deterministic multi-subagent workflow); on OpenCode, ask the agent to delegate to subagents, or mention one (`@general`).

**Modes:**

- **Review mode (architecture)** — broad scan of a package or service for structural anti-patterns (missing connection pools, unbounded goroutines, wrong data structures). Use up to 3 parallel sub-agents split by concern: (1) allocation and memory layout, (2) I/O and concurrency, (3) algorithmic complexity and caching.
- **Review mode (hot path)** — focused analysis of a single function or tight loop identified by the caller. Work sequentially; one sub-agent is sufficient.
- **Optimize mode** — a bottleneck has been identified by profiling. Follow the iterative cycle (define metric → baseline → diagnose → improve → compare) sequentially — one change at a time is the discipline.

**Dependencies:**

- benchstat: `go install golang.org/x/perf/cmd/benchstat@latest`

### Go Performance Optimization

#### Core Philosophy

1. **Profile before optimizing** — intuition about bottlenecks is wrong ~80% of the time. Use pprof to find actual hot spots (→ See [go-troubleshooting](../go-troubleshooting/SKILL.md) skill)
2. **Allocation reduction yields the biggest ROI** — Go's GC is fast but not free. Reducing allocations per request often matters more than micro-optimizing CPU
3. **Document optimizations** — add code comments explaining why a pattern is faster, with benchmark numbers when available. Future readers need context to avoid reverting an "unnecessary" optimization

#### Rule Out External Bottlenecks First

Before optimizing Go code, verify the bottleneck is in your process — if 90% of latency is a slow DB query or API call, reducing allocations won't help.

**Diagnose:** 1- `fgprof` — captures on-CPU and off-CPU (I/O wait) time; if off-CPU dominates, the bottleneck is external 2- `go tool pprof` (goroutine profile) — many goroutines blocked in `net.(*conn).Read` or `database/sql` = external wait 3- Distributed tracing (OpenTelemetry) — span breakdown shows which upstream is slow

**When external:** optimize that component instead — query tuning, caching, connection pools, circuit breakers (→ See [go-database](../go-database/SKILL.md) skill, [Caching Patterns](references/caching.md)).

#### Iterative Optimization Methodology

##### The cycle: Define Goals → Benchmark → Diagnose → Improve → Benchmark

1. **Define your metric** — latency, throughput, memory, or CPU? Without a target, optimizations are random
2. **Write an atomic benchmark** — isolate one function per benchmark to avoid result contamination (→ See [go-performance](SKILL.md) skill)
3. **Measure baseline** — `go test -bench=BenchmarkMyFunc -benchmem -count=6 ./pkg/... | tee /tmp/report-1.txt`
4. **Diagnose** — use the **Diagnose** lines in each deep-dive section to pick the right tool
5. **Improve** — apply ONE optimization at a time with an explanatory comment
6. **Compare** — `benchstat /tmp/report-1.txt /tmp/report-2.txt` to confirm statistical significance
7. **Commit** — paste the benchstat output in the commit body so reviewers and future readers see the exact improvement; follow the `perf(scope): summary` commit type
8. **Repeat** — increment report number, tackle next bottleneck

Refer to library documentation for known patterns before inventing custom solutions. Keep all `/tmp/report-*.txt` files as an audit trail.

When multiple candidate optimizations compete for the same bottleneck, implement each in an isolated worktree via a separate sub-agent — then → See [go-performance](SKILL.md) skill for comparing the variants and its serial-measurement caveat (concurrent benchmark runs on shared CPU contaminate results, even when the implementations themselves were built in parallel).

#### Decision Tree: Where Is Time Spent?

| Bottleneck | Signal (from pprof) | Action |
| --- | --- | --- |
| Too many allocations | `alloc_objects` high in heap profile | [Memory optimization](references/memory.md) |
| CPU-bound hot loop | function dominates CPU profile | [CPU optimization](references/cpu.md) |
| GC pauses / OOM | high GC%, container limits | [Runtime tuning](references/runtime.md) |
| Network / I/O latency | goroutines blocked on I/O | [I/O & networking](references/io-networking.md) |
| Repeated expensive work | same computation/fetch multiple times | [Caching patterns](references/caching.md) |
| Wrong algorithm | O(n²) where O(n) exists | [Algorithmic complexity](references/caching.md#algorithmic-complexity) |
| Lock contention | mutex/block profile hot | → See [go-concurrency](../go-concurrency/SKILL.md) skill |
| Slow queries | DB time dominates traces | → See [go-database](../go-database/SKILL.md) skill |

#### Common Mistakes

| Mistake | Fix |
| --- | --- |
| Optimizing without profiling | Profile with pprof first — intuition is wrong ~80% of the time |
| Default `http.Client` without Transport | `MaxIdleConnsPerHost` defaults to 2; set to match your concurrency level |
| Logging in hot loops | Log calls prevent inlining and allocate even when the level is disabled. Use zap's typed fields, and `log.Check(level, msg)` before building an expensive field |
| `panic`/`recover` as control flow | panic allocates a stack trace and unwinds the stack; use error returns |
| `unsafe` without benchmark proof | Only justified when profiling shows >10% improvement in a verified hot path |
| No GC tuning in containers | Set `GOMEMLIMIT` to 80-90% of container memory to prevent OOM kills |
| `reflect.DeepEqual` in production | 50-200x slower than typed comparison; use `slices.Equal`, `maps.Equal`, `bytes.Equal` |

#### Deep Dives

- [Memory Optimization](references/memory.md) — allocation patterns, backing array leaks, sync.Pool, struct alignment
- [CPU Optimization](references/cpu.md) — inlining, cache locality, false sharing, ILP, reflection avoidance
- [I/O & Networking](references/io-networking.md) — HTTP transport config, streaming, JSON performance, cgo, batch operations
- [Runtime Tuning](references/runtime.md) — GOGC, GOMEMLIMIT, GC diagnostics, GOMAXPROCS, PGO
- [Caching Patterns](references/caching.md) — algorithmic complexity, compiled patterns, singleflight, work avoidance
- [Production Observability](references/observability.md) — Prometheus metrics, PromQL queries, continuous profiling, alerting rules

#### CI Regression Detection

Automate benchmark comparison in CI to catch regressions before they reach production. → See [go-performance](SKILL.md) skill for `benchdiff` and `cob` setup.

#### Cross-References

- → See [go-performance](SKILL.md) skill for benchmarking methodology, `benchstat`, and `b.Loop()` (Go 1.24+)
- → See [go-troubleshooting](../go-troubleshooting/SKILL.md) skill for pprof workflow, escape analysis diagnostics, and performance debugging
- → See [go-data-structures](../go-data-structures/SKILL.md) skill for slice/map preallocation and `strings.Builder`
- → See [go-concurrency](../go-concurrency/SKILL.md) skill for worker pools, `sync.Pool` API, goroutine lifecycle, and lock contention
- → See [go-safety](../go-safety/SKILL.md) skill for defer in loops, slice backing array aliasing
- → See [go-database](../go-database/SKILL.md) skill for connection pool tuning and batch processing
- → See [go-observability](../go-observability/SKILL.md) skill for continuous profiling in production
