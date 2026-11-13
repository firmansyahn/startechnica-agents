---
title: Writes go through apiAction and return a Result
impact: CRITICAL
tags: proxy
check: review
---

## Writes go through apiAction and return a Result

**Impact: CRITICAL**

Server actions call the shared `apiAction(method, path, opts)`: the session from `headers()`, the same forwarding and refresh, the reply converted with `fromEnvelope` into a `Result`, backend unavailability as a 503 `Result`. No action builds its own `fetch` to the backend (`nextjs-data` Server actions rules).
