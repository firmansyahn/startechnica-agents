---
title: The server is ready on a health route, on its own port
impact: MEDIUM
tags: scope-and-ci
check: review
---

## The server is ready on a health route, on its own port

**Impact: MEDIUM**

`webServer.url` points at a route that answers 200 (`/livez`); `/` may answer 404 or redirect forever. Use a port from `E2E_PORT` other than 3000, so a run never reuses some other checkout's dev server.
