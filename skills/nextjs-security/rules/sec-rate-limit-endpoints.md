---
title: Expensive and guessable endpoints are rate-limited
impact: CRITICAL
tags: requests
check: review
---

## Expensive and guessable endpoints are rate-limited

**Impact: CRITICAL**

Sign-in, callbacks, password reset, invitations, uploads, search, export and the CSP report endpoint: limits at the edge or in the shared store (per account, session or IP), answering `429` with `Retry-After`. An in-memory counter per replica is not a limit.
