---
title: Configuration is read at runtime
impact: MEDIUM
tags: logging
check: review
---

## Configuration is read at runtime

**Impact: MEDIUM**

`LOG_LEVEL` and `SERVICE_NAME` are read when the process starts, never inlined at build. `pino-pretty` runs only in local development; every other environment gets JSON.
