---
title: Shared backends are isolated per worker
impact: MEDIUM
tags: data-and-auth
check: review
---

## Shared backends are isolated per worker

**Impact: MEDIUM**

Against a real or long-lived backend, each worker gets its own tenant/workspace from a worker-scoped fixture (`testInfo.parallelIndex`), so parallel tests never see each other's rows; fixtures clean up what they created.
