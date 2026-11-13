---
title: The client-error endpoint is validated and rate-limited
impact: MEDIUM
tags: errors
check: review
---

## The client-error endpoint is validated and rate-limited

**Impact: MEDIUM**

The route handler that receives browser reports parses the body with a schema, caps its size, rate-limits per session or IP, and logs at `error` with `"event.origin": "browser"`. An open endpoint is a log-flooding tool.
