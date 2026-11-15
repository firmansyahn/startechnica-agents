---
title: Log constant messages with fields and the request id
impact: MEDIUM
tags: logging, observability
check: eslint, scan (candidates), review
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags a template literal with expressions or a `+` concatenation as an argument of a `log`/`logger` call in app code. `scripts/scan.sh` lists calls on the root `logger` in request code (`src/api/`, `"use server"` files, `route.ts`), which should go through `requestLogger()`; a startup line or a notable business event on the root logger can be on purpose. Left to review: field names outside the team's scheme.
