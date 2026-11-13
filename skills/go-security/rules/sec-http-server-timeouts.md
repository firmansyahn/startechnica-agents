---
title: Give every http.Server read and idle timeouts
impact: HIGH
tags: security, http-server, slowloris, timeouts
check: scan, lint (gosec G112/G114)
---

## Give every http.Server read and idle timeouts

**Impact: HIGH** (slow clients hold connections open until the server runs out of file descriptors)

`http.ListenAndServe` and a bare `http.Server{}` have no timeouts. Every server sets at least `ReadHeaderTimeout`, plus `ReadTimeout`/`IdleTimeout`, and `WriteTimeout` unless it streams (then handlers set deadlines with `http.NewResponseController`). Shut down with `Shutdown(ctx)`, not by exiting.

**Incorrect:**

```go
log.Fatal(http.ListenAndServe(":8080", mux))
```

**Correct:**

```go
srv := &http.Server{
	Addr:              cfg.Addr,
	Handler:           mux,
	ReadHeaderTimeout: 5 * time.Second,
	ReadTimeout:       30 * time.Second,
	WriteTimeout:      60 * time.Second,
	IdleTimeout:       120 * time.Second,
}
go func() { errc <- srv.ListenAndServe() }()
// on stop: srv.Shutdown(shutdownCtx)
```

**How to check:** `scripts/scan.sh` flags package-level `http.ListenAndServe`/`ListenAndServeTLS`/`http.Serve` calls and `http.Server{...}` literals without `ReadHeaderTimeout` or `ReadTimeout`.
