---
title: Test-only sign-in can't be enabled in production
impact: MEDIUM
tags: data-and-auth
check: test, scan (candidates), review
---

## Test-only sign-in can't be enabled in production

**Impact: MEDIUM**

A route that mints a session without the real flow exists only behind a test flag, and the app refuses to start with that flag in a production environment. A unit test covers the refusal.

**How to check:** a unit test of the app's config or startup: with the flag (`E2E_AUTH=1`) and a production environment, loading it throws; without the flag the test sign-in route answers 404. `scripts/scan.sh` lists files that read `process.env.E2E_AUTH` (set `E2E_FLAG` for another name) and never mention `production`, the sign of a missing guard.
