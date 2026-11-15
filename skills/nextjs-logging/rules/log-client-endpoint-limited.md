---
title: The client-error endpoint is validated and rate-limited
impact: MEDIUM
tags: errors
check: test, review
---

## The client-error endpoint is validated and rate-limited

**Impact: MEDIUM**

The route handler that receives browser reports parses the body with a schema, caps its size, rate-limits per session or IP, and logs at `error` with `"event.origin": "browser"`. An open endpoint is a log-flooding tool.

**How to check:** `assets/tests/client-error-endpoint.test.ts` (copy it to the app's `tests/` and set the route, the cap, the limit and the limiter reset at its top) calls the route's `POST` and fails when a body over the cap isn't answered 413 (with and without `Content-Length`), a body failing the schema or not JSON isn't 400, report N+1 from one client isn't 429, or a valid report isn't logged exactly once at `error` with `"event.origin": "browser"`. It misses limits enforced only at the edge and a per-process store when the app runs several replicas; review those and the fields logged.
