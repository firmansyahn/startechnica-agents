---
title: Health probes are silent
impact: MEDIUM
tags: logging
check: scan, review
---

## Health probes are silent

**Impact: MEDIUM**

`/livez` and `/readyz` log nothing on success; an orchestrator calls them every few seconds.

**How to check:** `scripts/scan.sh` flags `log`/`logger` calls at `trace`, `debug` or `info` in route files under a `livez`, `readyz`, `healthz` or `health` folder; failure lines at `warn` or `error` are allowed. It misses a helper the probe calls that logs, and a proxy or middleware that logs every path including the probes: review those.
