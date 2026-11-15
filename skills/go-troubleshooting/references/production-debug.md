# Production Debugging

## Table of Contents

- [Production Debugging Checklist](#production-debugging-checklist)
  - [Step 1: Capture Immediately (don't restart!)](#step-1-capture-immediately-dont-restart)
  - [Step 2: System Metrics](#step-2-system-metrics)
  - [Step 3: Analyze Locally](#step-3-analyze-locally)
- [Logging & Observability](#logging--observability)
  - [Strategic Log Placement](#strategic-log-placement)
  - [Structured Logging (zap)](#structured-logging-zap)
  - [Request ID Tracing](#request-id-tracing)
- [Network & HTTP Debugging](#network--http-debugging)
  - [HTTP Client Issues](#http-client-issues)

## Production Debugging Checklist

When paged for a production issue:

### Step 1: Capture Immediately (don't restart!)

Capture all profiles before restarting the process. The curl commands in [pprof.md](pprof.md) can be used targeting your production server address. At minimum, capture: goroutine dump (`?debug=2`), heap, CPU (30s), and mutex profiles.

### Step 2: System Metrics

```bash
ps aux | grep myapp
lsof -p PID | wc -l       # file descriptors
ss -s                       # socket summary
netstat -an | grep ESTABLISHED | wc -l
```

### Step 3: Analyze Locally

Download the captured `.prof` files and analyze with `go tool pprof` (see [pprof.md](pprof.md)).

---

## Logging & Observability

### Strategic Log Placement

Place logs at **component boundaries**, not sprinkled randomly. The goal is to see data entering and exiting each layer, so you can identify exactly which component corrupts or drops it:

```go
// s.log is the *zap.Logger injected into the service's constructor (go-observability)

// 1. Function entry/exit with key parameters
func (s *OrderService) ProcessOrder(ctx context.Context, orderID string) error {
    s.log.Debug("ProcessOrder: start", zap.String("order_id", orderID))
    defer s.log.Debug("ProcessOrder: done", zap.String("order_id", orderID))
    // ...
}

// 2. Before and after external calls
s.log.Debug("calling payment API", zap.String("order_id", orderID))
resp, err := s.payments.Charge(ctx, req)
if err != nil {
    s.log.Warn("payment API failed", zap.String("order_id", orderID), zap.Error(err))
} else {
    s.log.Debug("payment API answered", zap.Int("status", resp.StatusCode))
}

// 3. At decision points
if user.IsAdmin {
    s.log.Debug("admin path", zap.String("user_id", user.ID))
}
```

### Structured Logging (zap)

```go
import "go.uber.org/zap"

log := WithTrace(ctx, s.log) // adds trace.id and span.id (go-observability)

log.Info("processing request",
    zap.String("method", r.Method),
    zap.String("path", r.URL.Path),
    zap.String("user_id", userID),
)

log.Error("database query failed",
    zap.Error(err),
    zap.String("query", query),
    zap.Duration("duration", elapsed),
)
```

### Request ID Tracing

In a traced request, the `trace.id` that `WithTrace` adds already ties the log lines together; a request ID is for a service without tracing.

```go
type ctxKey string

func WithRequestID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, ctxKey("request_id"), id)
}

func RequestID(ctx context.Context) string {
    id, _ := ctx.Value(ctxKey("request_id")).(string)
    return id
}
```

---

## Network & HTTP Debugging

### HTTP Client Issues

```go
// 1. HTTP clients MUST set timeouts — default http.Client has NO timeout
client := &http.Client{
    Timeout: 30 * time.Second,
    Transport: &http.Transport{
        DialContext:          (&net.Dialer{Timeout: 5 * time.Second}).DialContext,
        TLSHandshakeTimeout: 5 * time.Second,
        IdleConnTimeout:     90 * time.Second,
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 10,
    },
}

// 2. Response body MUST be closed
resp, err := client.Do(req)
if err != nil {
    return err
}
defer resp.Body.Close()

// 3. Read body on error status (for error messages from server)
if resp.StatusCode >= 400 {
    body, _ := io.ReadAll(resp.Body)
    return fmt.Errorf("API error %d: %s", resp.StatusCode, body)
}

// 4. Dump full request/response for debugging (dumps include headers such as Authorization: local debugging only)
import "net/http/httputil"
dump, _ := httputil.DumpRequestOut(req, true)
s.log.Debug("request", zap.ByteString("dump", dump))
dump, _ = httputil.DumpResponse(resp, true)
s.log.Debug("response", zap.ByteString("dump", dump))
```
