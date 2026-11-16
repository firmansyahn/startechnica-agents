---
name: go-observability
description: "Use when instrumenting a Go service for production: structured logging with zap (an injected *zap.Logger, levels, ECS json to stdout through ecszap, the logging block in the settings file, trace.id and span.id in log lines), Prometheus metrics (the four types, low-cardinality labels, PromQL as comments), OpenTelemetry tracing (spans, sampling, context propagation), profiling (pprof toggles, Pyroscope), alerting and Grafana dashboards, or reviewing a diff that adds or changes instrumentation. Absorbs samber/cc-skills-golang@golang-observability, adapted to the team (zap instead of slog, injected logger, the logging config block). Not for a one-off performance investigation (`go-performance` references/benchmark.md, go-performance)."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.2.2"
---

# Go observability (team)

**Principle:** A feature is done when it is observable: structured logs through the injected zap logger, bounded metrics with their queries beside them, and spans on every meaningful operation.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-observability` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's rules and decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-code-style](../go-code-style/SKILL.md) (the injected structured logger, `style-structured-logger`), [go-security](../go-security/SKILL.md) (`sec-no-secrets-in-logs`), [go-knadh-koanf](../go-knadh-koanf/SKILL.md) (the `logging` and `metrics` blocks in the settings file), [go-http-handlers](../go-http-handlers/SKILL.md) (request logging middleware), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Adding or changing metrics, spans, log lines or profiling toggles in a Go service
- Setting up observability in a new service: logger, TracerProvider, metrics endpoint
- Reviewing a diff that touches instrumentation

## The team's rules

- **The team logs with zap, not slog.** A `*zap.Logger` with typed fields (`zap.String`, `zap.Error`), not the `SugaredLogger`.
- **The logger is injected**, built once at the root from the settings file's `logging` block (`level`, `format`, `probe.enabled`; [go-knadh-koanf](../go-knadh-koanf/SKILL.md) section 4b), with `defer log.Sync()` in `main`; never `zap.L()` or `zap.ReplaceGlobals` (`style-structured-logger`).
- **The Prometheus endpoint is configured** with `metrics.enabled`, `metrics.port` and `metrics.path` ([go-knadh-koanf](../go-knadh-koanf/SKILL.md) section 4c); it uses a dedicated internal listener and is not exposed on the public application listener.
- **`format: json` writes one Elastic Common Schema object per line to stdout** through `go.elastic.co/ecszap` — that is what a deployment collects; `console` is zap's development encoder, for a terminal.
- **Log lines in a traced request carry `trace.id` and `span.id`**, from a helper that derives the logger from the span context (zap takes no `ctx`).
- **Kubernetes probe routes are `/livez` and `/readyz` only**: `/livez` reports process liveness, `/readyz` reports readiness for traffic, and `/healthz` is not an alias. Probe requests are not logged by default (`probe.enabled: false`).
- **Every metric var has its PromQL queries and alert rules as comments above its declaration**, so the queries live where the metric is defined.
- **Labels are bounded:** never an unbounded value (user ID, full URL) as a label; the route pattern, not the path.
- **A feature is not done until it is observable:** metrics declared, spans opened and closed, structured log fields consistent.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [obs-kubernetes-probe-paths](rules/obs-kubernetes-probe-paths.md) | Expose Kubernetes probes only at `/livez` and `/readyz` | MEDIUM | test, review |

## Team decisions

1. **zap, not slog.** Upstream builds on `log/slog` and tells projects to migrate zap to it; the team uses zap. Upstream's slog material is rewritten for zap: the handler setup is an `ecszap` core, `slog.*Context` trace correlation is a `WithTrace(ctx, log)` helper, `slog.NewMultiHandler`/`slog-multi` is `zapcore.NewTee`, `slog-sampling` is zap's sampler, and the "migrate zap to slog" guidance is removed. A dependency that wants a `*slog.Logger` gets one over the same core (`zapslog.NewHandler(log.Core())`). A project whose `AGENTS.md` settles on another logger keeps it.
2. **The injected logger wins** over upstream's process-wide default: the logger is constructed from the settings file and passed to constructors (`NewStore(db, log)`), never set with `zap.ReplaceGlobals`.
3. **The logging block in the settings file** (`level`, `format`, `probe.enabled`) is the team's minimum, from [go-knadh-koanf](../go-knadh-koanf/SKILL.md) section 4b; upstream's environment-variable toggles for profiling are kept.
4. **Errors are logged or returned, never both** — the single handling rule lives in [go-error-handling](../go-error-handling/SKILL.md) (`err-handle-once`); upstream passages that show a log call plus `return err` are read through that rule.
5. Upstream's external PromQL CLI skill is not included; use the Prometheus UI/API or project-documented tooling instead.

## Review checklist

- [ ] The logger is an injected `*zap.Logger`, built from the `logging` block; no `zap.L()`, `zap.ReplaceGlobals` or `SugaredLogger` in library code
- [ ] New metrics have PromQL and alert rules as comments above their declarations
- [ ] Labels bounded; no user IDs or full URLs as label values
- [ ] Spans opened and closed on service methods, DB queries, external calls; errors recorded with `span.RecordError()`
- [ ] No PII in logs; probe requests stay unlogged unless `probe.enabled` is on
- [ ] Kubernetes probes are `/livez` (liveness) and `/readyz` (readiness); `/healthz` is not registered
- [ ] Log lines in traced code carry `trace.id`/`span.id` (`WithTrace(ctx, log)`); errors logged with `zap.Error(err)`, messages constant

## In depth

The material below is `samber/cc-skills-golang@golang-observability`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's rules and decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: each one the team uses is absorbed into a team skill ([go-how-to](../go-how-to/SKILL.md), rule 1, maps the names), and the rest are not adopted.

**Persona:** You are a Go observability engineer. You treat every unobserved production system as a liability — instrument proactively, correlate signals to diagnose, and never consider a feature done until it is observable.

**Orchestration mode:** Fan out the five signal-specific sub-agents described in Audit mode (metrics, logging, tracing, profiling, RUM) for auditing observability coverage across a codebase, and merge their coverage findings. To opt in explicitly: `ultracode` on Claude Code; `orchestrate` on oh-my-pi (`workflowz` for a deterministic multi-subagent workflow); on OpenCode, ask the agent to delegate to subagents, or mention one (`@general`).

**Modes:**

- **Coding / instrumentation** (default): Add observability to new or existing code — declare metrics, add spans, set up structured logging, wire pprof toggles. Follow the sequential instrumentation guide.
- **Review mode** — reviewing a PR's instrumentation changes. Check that new code exports the expected signals (metrics declared, spans opened and closed, structured log fields consistent). Sequential.
- **Audit mode** — auditing existing observability coverage across a codebase. Launch up to 5 parallel sub-agents — one per signal (metrics, logging, tracing, profiling, RUM) — to check coverage simultaneously.

### Go Observability Best Practices

Observability is the ability to understand a system's internal state from its external outputs. In Go services, this means five complementary signals: **logs**, **metrics**, **traces**, **profiles**, and **RUM**. Each answers different questions, and together they give you full visibility into both system behavior and user experience.

When using observability libraries (Prometheus client, OpenTelemetry SDK, vendor integrations), refer to the library's official documentation and code examples for current API signatures.

#### Best Practices Summary

1. **Use structured logging** with `zap` — production services MUST emit structured logs (ECS JSON), not freeform strings
2. **Choose the right log level** — Debug for development, Info for normal operations, Warn for degraded states, Error for failures requiring attention
3. **Log with the trace** — derive the logger with `WithTrace(ctx, log)` so lines carry `trace.id` and `span.id`
4. **Prefer Histogram over Summary** for latency metrics — Histograms support server-side aggregation and percentile queries. Every HTTP endpoint MUST have latency and error rate metrics.
5. **Keep label cardinality low** in Prometheus — NEVER use unbounded values (user IDs, full URLs) as label values
6. **Track percentiles** (P50, P90, P99, P99.9) using Histograms + `histogram_quantile()` in PromQL
7. **Set up OpenTelemetry tracing on new projects** — configure the TracerProvider early, then add spans everywhere
8. **Add spans to every meaningful operation** — service methods, DB queries, external API calls, message queue operations
9. **Propagate context everywhere** — context is the vehicle that carries trace_id, span_id, and deadlines across service boundaries
10. **Enable profiling via environment variables** — toggle pprof and continuous profiling on/off without redeploying
11. **Correlate signals** — inject trace_id into logs, use exemplars to link metrics to traces
12. **A feature is not done until it is observable** — declare metrics, add proper logging, create spans
13. **[awesome-prometheus-alerts](https://samber.github.io/awesome-prometheus-alerts/) provides ~500 ready-to-use alerting rules** organized by technology for infrastructure and dependency monitoring

#### Cross-References

- → [go-error-handling](../go-error-handling/SKILL.md) for the single handling rule.
- → [go-troubleshooting](../go-troubleshooting/SKILL.md) for using observability signals to diagnose production issues.
- → [go-security](../go-security/SKILL.md) for protecting pprof endpoints and avoiding PII in logs.
- → [[go-concurrency](../go-concurrency/SKILL.md) references/context.md](../go-concurrency/references/context.md) for propagating trace context across service boundaries.

##### Several log destinations: `zapcore.NewTee`

Logs go to stdout and the platform's collector ships them. When the process itself needs a second destination, tee zap cores; each keeps its own level.

```go
log := zap.New(zapcore.NewTee(
    ecszap.NewCore(ecszap.NewDefaultEncoderConfig(), zapcore.Lock(os.Stdout), level),
    auditCore,
), zap.AddCaller())
```

#### The Five Signals

| Signal | Question it answers | Tool | When to use |
| --- | --- | --- | --- |
| **Logs** | What happened? | `zap` + `ecszap` | Discrete events, errors, audit trails |
| **Metrics** | How much / how fast? | Prometheus client | Aggregated measurements, alerting, SLOs |
| **Traces** | Where did time go? | OpenTelemetry | Request flow across services, latency breakdown |
| **Profiles** | Why is it slow / using memory? | pprof, Pyroscope | CPU hotspots, memory leaks, lock contention |
| **RUM** | How do users experience it? | PostHog, Segment | Product analytics, funnels, session replay |

#### Detailed Guides

Each signal has a dedicated guide with full code examples, configuration patterns, and cost analysis:

- **[Structured Logging](references/logging.md)** — Why structured logging matters for log aggregation at scale. Covers building the `*zap.Logger` from the `logging` block (`ecszap` json or console), log levels and when to use each, sampling and the cost of logging, trace correlation with `trace.id`/`span.id`, the access-log middleware (probes skipped), several destinations with `zapcore.NewTee`, a `*slog.Logger` for dependencies that want one, and common zap mistakes.

- **[Metrics Collection](references/metrics.md)** — Prometheus client setup and the four metric types (Counter for rate-of-change, Gauge for snapshots, Histogram for latency aggregation). Deep dive: why Histograms beat Summaries (server-side aggregation, supports `histogram_quantile` PromQL), naming conventions, the PromQL-as-comments convention (write queries above metric declarations for discoverability), production-grade PromQL examples, multi-window SLO burn rate alerting, and the high-cardinality label problem (why unbounded values like user IDs destroy performance).

- **[Distributed Tracing](references/tracing.md)** — When and how to use OpenTelemetry SDK to trace request flows across services. Covers spans (creating, attributes, status recording), `otelhttp` middleware for HTTP instrumentation, error recording with `span.RecordError()`, trace sampling (why you can't collect everything at scale), propagating trace context across service boundaries, and cost optimization.

- **[Profiling](references/profiling.md)** — On-demand profiling with pprof (CPU, heap, goroutine, mutex, block profiles) — how to enable it in production, secure it with auth, and toggle via environment variables without redeploying. Continuous profiling with Pyroscope for always-on performance visibility. Cost implications of each profiling type and mitigation strategies.

- **[Real User Monitoring](references/rum.md)** — Understanding how users actually experience your service. Covers product analytics (event tracking, funnels), Customer Data Platform integration, and critical compliance: GDPR/CCPA consent checks, data subject rights (user deletion endpoints), and privacy checklist for tracking. Server-side event tracking (PostHog, Segment) and identity key best practices.

- **[Alerting](references/alerting.md)** — Proactive problem detection. Covers the four golden signals (latency, traffic, errors, saturation), [awesome-prometheus-alerts](https://samber.github.io/awesome-prometheus-alerts/) provides ~500 ready-to-use rules by technology, Go runtime alerts (goroutine leaks, GC pressure, OOM risk), severity levels, and common mistakes that break alerting (using `irate` instead of `rate`, missing `for:` duration to avoid flapping).

- **[Grafana Dashboards](references/dashboards.md)** — Prebuilt dashboards for Go runtime monitoring (heap allocation, GC pause frequency, goroutine count, CPU). Explains the standard dashboards to install, how to customize them for your service, and when each dashboard answers a different operational question.

#### Correlating Signals

Signals are most powerful when connected. A trace_id in your logs lets you jump from a log line to the full request trace. An exemplar on a metric links a latency spike to the exact trace that caused it.

##### Logs + Traces: `trace.id` and `span.id` fields

zap takes no `ctx`, so the logger is derived from the span context ([references/logging.md](references/logging.md), Trace Correlation):

```go
func WithTrace(ctx context.Context, log *zap.Logger) *zap.Logger {
    sc := trace.SpanContextFromContext(ctx)
    if !sc.IsValid() {
        return log
    }
    return log.With(
        zap.String("trace.id", sc.TraceID().String()),
        zap.String("span.id", sc.SpanID().String()),
    )
}

logging.WithTrace(ctx, s.log).Info("order created", zap.String("order_id", orderID))
// Output includes: {"trace.id":"abc123", "span.id":"def456", "message":"order created", ...}
```

When logs ship over OTLP instead of stdout, the `go.opentelemetry.io/contrib/bridges/otelzap` core attaches the trace context; tee it with the stdout core.

##### Metrics + Traces: Exemplars

```go
// When recording a histogram observation, attach the trace_id as an exemplar
// so you can jump from a P99 spike directly to the offending trace
obs := histogram.WithLabelValues("POST", "/orders")
if eo, ok := obs.(prometheus.ExemplarObserver); ok {
    eo.ObserveWithExemplar(duration, prometheus.Labels{"trace_id": traceID})
} else {
    obs.Observe(duration)
}
```

#### Other Loggers

The team logs with zap; don't migrate a zap project to `slog`. A dependency that takes a `*slog.Logger` gets one backed by the same core, `slog.New(zapslog.NewHandler(log.Core()))` from `go.uber.org/zap/exp/zapslog`. A project on `slog`, `logrus` or `zerolog` follows its own `AGENTS.md`; moving it to zap is a separate change ([references/logging.md](references/logging.md)).

#### Definition of Done for Observability

A feature is not production-ready until it is observable. Before marking a feature as done, verify:

- [ ] **Metrics declared** — counters for operations/errors, histograms for latencies, gauges for saturation. Each metric var has PromQL queries and alert rules as comments above its declaration.
- [ ] **Logging is proper** — typed zap fields and constant messages through the injected `*zap.Logger`, `trace.id`/`span.id` on lines in traced code, no PII in logs, errors MUST be either logged OR returned (NEVER both).
- [ ] **Spans created** — every service method, DB query, and external API call has a span with relevant attributes, errors recorded with `span.RecordError()`.
- [ ] **Dashboards and alerts exist** — the PromQL from your metric comments is wired into Grafana dashboards and Prometheus alerting rules. Ready-to-use alert rules for common infrastructure dependencies are available at [awesome-prometheus-alerts](https://samber.github.io/awesome-prometheus-alerts/).
- [ ] **RUM events tracked** — key business events tracked server-side (PostHog/Segment), identity key is `user_id` (not email), consent checked before tracking.

#### Common Mistakes

```go
// ✗ Bad — log AND return (error gets logged multiple times up the chain)
if err != nil {
    s.log.Error("query failed", zap.Error(err))
    return fmt.Errorf("query: %w", err)
}

// ✓ Good — return with context, log once at the top level
if err != nil {
    return fmt.Errorf("querying users: %w", err)
}
```

```go
// ✗ Bad — high-cardinality label (unbounded user IDs)
httpRequests.WithLabelValues(r.Method, r.URL.Path, userID).Inc()

// ✓ Good — bounded label values only
httpRequests.WithLabelValues(r.Method, routePattern).Inc()
```

```go
// ✗ Bad — not passing context (breaks trace propagation)
result, err := db.Query("SELECT ...")

// ✓ Good — context flows through, trace continues
result, err := db.QueryContext(ctx, "SELECT ...")
```

```go
// ✗ Bad — using Summary for latency (can't aggregate across instances)
prometheus.NewSummary(prometheus.SummaryOpts{
    Name:       "http_request_duration_seconds",
    Objectives: map[float64]float64{0.99: 0.001},
})

// ✓ Good — use Histogram (aggregatable, supports histogram_quantile)
prometheus.NewHistogram(prometheus.HistogramOpts{
    Name:    "http_request_duration_seconds",
    Buckets: prometheus.DefBuckets,
})
```
