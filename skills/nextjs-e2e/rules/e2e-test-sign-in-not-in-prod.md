---
title: Test-only sign-in can't be enabled in production
impact: MEDIUM
tags: data-and-auth
check: review
---

## Test-only sign-in can't be enabled in production

**Impact: MEDIUM**

A route that mints a session without the real flow exists only behind a test flag, and the app refuses to start with that flag in a production environment. A unit test covers the refusal.
