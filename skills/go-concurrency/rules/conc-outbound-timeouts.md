---
title: Bound every outbound call with a context or client timeout
impact: HIGH
tags: concurrency, http-client, timeouts
check: scan, lint (noctx)
---

## Bound every outbound call with a context or client timeout

**Impact: HIGH** (`http.DefaultClient` never times out: one hung vendor API blocks handlers and workers until the process runs out of goroutines or connections)

Outbound HTTP uses a client with a `Timeout` (or a transport with dial, TLS and response-header timeouts), and every request is built with `http.NewRequestWithContext(ctx, ...)` so cancellation reaches it. No `http.Get`/`http.Post`/`http.DefaultClient`. The same goes for other protocols: `net.Dialer{Timeout}`, `conn.SetDeadline`, a context on every database and RPC call.

**Incorrect:**

```go
resp, err := http.Get(vendorURL + "/status")
```

**Correct:**

```go
// one client per vendor, built once and injected
client := &http.Client{Timeout: 10 * time.Second}

req, err := http.NewRequestWithContext(ctx, http.MethodGet, vendorURL+"/status", nil)
if err != nil {
	return fmt.Errorf("build status request: %w", err)
}
resp, err := client.Do(req)
```

**How to check:** `scripts/scan.sh` flags `http.Get/Post/Head/PostForm`, `http.DefaultClient`, `&http.Client{}` and `http.NewRequest(` without context. `noctx` covers requests without a context.
