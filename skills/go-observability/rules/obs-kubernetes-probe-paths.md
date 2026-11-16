---
title: Expose Kubernetes probes only at /livez and /readyz
impact: MEDIUM
tags: kubernetes, probes, health
check: test, review
---

## Expose Kubernetes probes only at /livez and /readyz

**Impact: MEDIUM** (misnamed or conflated probes can make deployments route traffic to an unready service or restart a live one)

Register `/livez` for process liveness and `/readyz` for readiness to accept traffic; do not register `/healthz` as a probe or alias. Keep the checks distinct so a temporary dependency outage can make a service unready without causing Kubernetes to restart it.

**Incorrect (what's wrong):**

```go
mux.Handle("/healthz", healthHandler)
mux.Handle("/livez", healthHandler)
mux.Handle("/readyz", healthHandler)
```

**Correct:**

```go
mux.Handle("/livez", livenessHandler)
mux.Handle("/readyz", readinessHandler)
```

**How to check:** route tests assert that `/livez` and `/readyz` are registered with their distinct handlers and `/healthz` is not registered; review that liveness does not fail solely because a dependency is unavailable.
