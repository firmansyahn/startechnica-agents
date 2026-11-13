---
title: Field names follow the backend's scheme
impact: MEDIUM
tags: logging
check: review
---

## Field names follow the backend's scheme

**Impact: MEDIUM**

One scheme, ECS or OpenTelemetry semantic conventions, the same one the backend uses: `http.request.id`, `http.request.method`, `url.path`, `http.response.status_code`, `event.duration` (nanoseconds in ECS), `service.name`, `log.level`, `message`. Invented names (`reqId`, `statusCode`, `took_ms`) can't be joined with the backend's lines.
