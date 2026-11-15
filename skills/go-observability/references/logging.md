# Structured Logging with `zap`

The team logs with [`go.uber.org/zap`](https://pkg.go.dev/go.uber.org/zap): a `*zap.Logger` built once at the root from the settings file's `logging` block and injected into constructors. → See [go-error-handling](../../go-error-handling/SKILL.md) for the single handling rule (`err-handle-once`).

## Table of Contents

- [Why Structured Logging](#why-structured-logging)
- [Building the Logger](#building-the-logger)
- [Log Levels](#log-levels)
- [Cost of Logging](#cost-of-logging)
- [Trace Correlation](#trace-correlation)
- [Request Logging](#request-logging)
- [Several Destinations](#several-destinations)
- [Libraries that Want `*slog.Logger`](#libraries-that-want-sloglogger)
- [A Project on slog, logrus or zerolog](#a-project-on-slog-logrus-or-zerolog)
- [Common Logging Mistakes](#common-logging-mistakes)

## Why Structured Logging

Structured logs emit typed fields instead of freeform strings. Log management systems (Grafana Loki, Elasticsearch, Datadog) can index, filter and aggregate structured fields — something impossible with `log.Printf` output.

```go
// ✗ Bad — freeform string, impossible to filter by customer_id
log.Printf("ERROR: failed to sync customer %s: %v", id, err)

// ✓ Good — constant message, typed fields
s.log.Error("customer sync failed",
    zap.String("customer_id", id),
    zap.Error(err),
)
// json output (ECS): {"@timestamp":"2026-01-15T10:30:00.000Z","log.level":"error","message":"customer sync failed","customer_id":"c-123","error":{"message":"connection refused"},"ecs.version":"1.6.0"}
```

Use `*zap.Logger` with typed fields (`zap.String`, `zap.Int64`, `zap.Duration`, `zap.Error`). The `SugaredLogger` (`Infow`, `Infof`) is for `package main` and command-line tools at most: its loosely typed key-value pairs are slower and fail at run time on an odd count.

## Building the Logger

The settings file's `logging` block ([go-knadh-koanf](../../go-knadh-koanf/SKILL.md) section 4b) decides the level and the encoder. `format: json` writes one [Elastic Common Schema](https://www.elastic.co/guide/en/ecs/current/index.html) object per line to stdout through [`go.elastic.co/ecszap`](https://pkg.go.dev/go.elastic.co/ecszap); `console` is zap's development encoder, for a terminal.

```go
import (
    "os"

    "go.elastic.co/ecszap"
    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"
)

// NewLogger builds the process logger from the logging block. Called once, in main.
func NewLogger(cfg config.Logging) (*zap.Logger, error) {
    level, err := zapcore.ParseLevel(cfg.Level) // debug, info, warn, error
    if err != nil {
        return nil, fmt.Errorf("logging.level: %w", err)
    }

    var core zapcore.Core
    switch cfg.Format {
    case "console":
        enc := zapcore.NewConsoleEncoder(zap.NewDevelopmentEncoderConfig())
        core = zapcore.NewCore(enc, zapcore.Lock(os.Stdout), level)
    default: // json
        core = ecszap.NewCore(ecszap.NewDefaultEncoderConfig(), zapcore.Lock(os.Stdout), level)
    }
    return zap.New(core, zap.AddCaller()), nil
}
```

```go
// main.go — build, defer Sync, inject
log, err := logging.NewLogger(cfg.Logging)
if err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(1)
}
defer log.Sync() // flush buffered entries before exit

store := orders.NewStore(db, log.Named("orders"))
```

- **Production MUST use `json`** — plain-text multiline output (stack traces) is split into separate records by log collectors.
- **stdout, not stderr:** `zap.NewProduction()` writes to stderr and uses zap's own keys (`ts`, `msg`), not ECS; build the core as above instead.
- **No globals:** never `zap.ReplaceGlobals` or `zap.L()` in library code; pass the logger (`style-structured-logger`, `layer-inject-dependencies`). `log.Named("orders")` and `log.With(...)` give a component its own child logger.
- For a level that changes without a restart, use `zap.NewAtomicLevelAt(level)` as the core's level; `zap.AtomicLevel` is an `http.Handler` (GET/PUT the level), so mount it on the internal port beside pprof, never the public one.

## Log Levels

```go
log.Debug("cache lookup", zap.String("key", cacheKey), zap.Bool("hit", false))
log.Info("order created", zap.String("order_id", orderID), zap.Int64("total_cents", amount))
log.Warn("rate limit approaching", zap.Float64("current_usage", 0.92), zap.Int("limit", 1000))
log.Error("payment failed", zap.String("order_id", orderID), zap.Error(err))
```

**Rule of thumb**: if you're unsure between Warn and Error, ask "did the operation succeed?" If yes (even with degradation), use Warn. If no, use Error. `DPanic`, `Panic` and `Fatal` are for `package main` at most: `Fatal` calls `os.Exit` and skips deferred cleanup.

## Cost of Logging

Logging is not free. Each log line costs CPU (serialization), I/O (disk/network), and money (log ingestion/storage in your aggregation platform). The cost scales with volume, which is directly controlled by log level.

- **Debug level in production** can generate millions of log lines per minute in a busy service, overwhelming your log pipeline and inflating costs by 10-100x
- **Info level** is the typical production default — it provides enough visibility without excessive volume
- Debug level SHOULD be disabled in production — `level: info` in the settings file in production, `debug` only in development or while actively debugging a specific issue (an `AtomicLevel` lets you raise it briefly without a redeploy)
- For high-throughput services, wrap the core in zap's sampler rather than dropping verbose logs entirely: `zapcore.NewSamplerWithOptions(core, time.Second, 100, 100)` keeps the first 100 entries with the same level and message per second, then every 100th
- Guard an expensive field with `if ce := log.Check(zap.DebugLevel, "payload"); ce != nil { ce.Write(zap.Any("payload", big)) }` so it is built only when the level is on

## Trace Correlation

zap has no `ctx` argument, so trace correlation is explicit: derive a logger with the span's ids from the request context. With ECS, the fields are `trace.id` and `span.id`, which Grafana and Kibana link to the trace.

```go
import "go.opentelemetry.io/otel/trace"

// WithTrace returns log with the current span's trace.id and span.id, or log itself
// when ctx carries no span.
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
```

```go
func (s *OrderService) Create(ctx context.Context, req CreateOrderRequest) error {
    ctx, span := s.tracer.Start(ctx, "OrderService.Create")
    defer span.End()

    log := logging.WithTrace(ctx, s.log)
    log.Info("creating order", zap.String("order_id", req.ID))
    // ...
}
```

When logs ship over OTLP instead of being collected from stdout, the [`otelzap`](https://pkg.go.dev/go.opentelemetry.io/contrib/bridges/otelzap) bridge is a `zapcore.Core` that sends entries to the OpenTelemetry Logs SDK with trace context attached; tee it with the stdout core (see below) and check the bridge's docs for passing the context.

## Request Logging

One access line per request, from middleware, with ECS field names. Probe requests are skipped unless `logging.probe.enabled` is on.

```go
func AccessLog(log *zap.Logger, logProbes bool) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !logProbes && (r.URL.Path == "/livez" || r.URL.Path == "/readyz") {
                next.ServeHTTP(w, r)
                return
            }
            start := time.Now()
            rw := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
            next.ServeHTTP(rw, r)

            WithTrace(r.Context(), log).Info("request",
                zap.String("http.request.method", r.Method),
                zap.String("url.path", r.URL.Path),
                zap.Int("http.response.status_code", rw.status),
                zap.Duration("event.duration", time.Since(start)),
            )
        })
    }
}
```

## Several Destinations

The process writes to stdout; the platform's collector (Grafana Alloy, Fluent Bit, the Datadog agent) ships it to Loki, Elasticsearch or Datadog. Don't send logs to a backend from the service unless the platform has no collector.

When the process does need a second destination (errors to Sentry, OTLP), tee cores — each keeps its own level:

```go
core := zapcore.NewTee(
    stdoutCore,  // everything at the configured level
    sentryCore,  // a Sentry zap core at zapcore.ErrorLevel
)
log := zap.New(core, zap.AddCaller())
```

## Libraries that Want `*slog.Logger`

Some dependencies take a `*slog.Logger`. Give them one backed by the same zap core, so their lines come out in the same format and level:

```go
import "go.uber.org/zap/exp/zapslog"

client := thirdparty.New(thirdparty.Options{
    Logger: slog.New(zapslog.NewHandler(log.Core())),
})
```

Check the installed `zap/exp` version for `NewHandler`'s options. Project code still takes `*zap.Logger`.

## A Project on slog, logrus or zerolog

The project's own `AGENTS.md` or `CLAUDE.md` wins: a project that settled on another logger keeps it, and new code follows it. Moving a project to zap is a separate change the team decides on; when it does, inject the new `*zap.Logger` at the root first, migrate one package at a time (each constructor takes `*zap.Logger`), and remove the old dependency once nothing imports it.

## Common Logging Mistakes

```go
// ✗ Bad — errors MUST be either logged OR returned, NEVER both (single handling rule violation)
if err != nil {
    s.log.Error("query failed", zap.Error(err))
    return fmt.Errorf("query: %w", err) // error gets logged twice up the chain
}

// ✓ Good — return with context, log at the top level
if err != nil {
    return fmt.Errorf("querying users: %w", err)
}

// ✗ Bad — the global logger, a formatted message, an untyped error
zap.L().Info(fmt.Sprintf("user %s logged in", user.ID))
s.log.Error("payment failed", zap.String("error", err.Error()))

// ✓ Good — injected logger, constant message, typed fields
s.log.Info("user logged in", zap.String("user_id", user.ID))
s.log.Error("payment failed", zap.Error(err)) // ECS error.message, error.type

// ✗ Bad — sugared key-value pairs: err has no key, so the pairs are off by one
s.log.Sugar().Errorw("payment failed", err, "order_id", orderID)

// ✓ Good
s.log.Error("payment failed", zap.Error(err), zap.String("order_id", orderID))

// ✗ Bad — NEVER log PII (emails, national IDs, passwords, tokens)
s.log.Info("user logged in", zap.String("email", user.Email))

// ✓ Good — log identifiers, not sensitive data
s.log.Info("user logged in", zap.String("user_id", user.ID))
```

- Forgetting `defer log.Sync()` in `main` loses the last buffered entries on exit.
- `zap.Any` on a struct that holds a secret logs the secret; log the fields you need, or give the type a redacting `MarshalLogObject` (`sec-no-secrets-in-logs`).
