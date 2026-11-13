---
title: Log constant messages with fields and the request id
impact: MEDIUM
tags: logging, observability
check: review
---

## Log constant messages with fields and the request id

**Impact: MEDIUM** (logs can't be searched, grouped or joined with the backend's)

The message is a constant phrase; data goes in fields named by the team's scheme; errors go in `err`. Every line carries the request id from `x-request-id`, which the proxy sets and the backend also logs.

**Incorrect:**

```ts
logger.error(`Failed to load items for tenant ${tenant}: ${err.message}`);
```

**Correct:**

```ts
const log = await requestLogger();
log.error({ err, "tenant.id": tenant }, "load items failed");
```

**How to check:** look for template literals as log messages and for `logger.` calls in request code that don't use the request-scoped child logger.
