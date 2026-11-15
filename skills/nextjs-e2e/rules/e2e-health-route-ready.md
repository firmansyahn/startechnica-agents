---
title: The server is ready on a health route, on its own port
impact: MEDIUM
tags: scope-and-ci
check: test, review
---

## The server is ready on a health route, on its own port

**Impact: MEDIUM**

`webServer.url` points at a route that answers 200 (`/livez`); `/` may answer 404 or redirect forever. Use a port from `E2E_PORT` other than 3000, so a run never reuses some other checkout's dev server.

**How to check:** [assets/tests/e2e-setup.test.ts](../assets/tests/e2e-setup.test.ts) loads `playwright.config.ts` with `CI=1` and no `E2E_PORT`, and fails when a web server has no `url`, waits on `/`, or the app's server listens on 3000. Whether the route answers 200 only once the app can serve pages stays review.
