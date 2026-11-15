---
title: Errors go in err
impact: MEDIUM
tags: logging
check: eslint, review
---

## Errors go in err

**Impact: MEDIUM**

Pass the error object as `err`, so pino serialises its type, message and stack. Don't stringify it into the message, and don't log `err.message` alone.

**Incorrect:**

```ts
log.error(`refresh failed: ${e}`);
```

**Correct:**

```ts
log.error({ err: e }, "token refresh failed");
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags, on a `log.<level>(` or `logger.<level>(` call in app code, `e`, `err`, `error` or `.message` interpolated into the message, an error logged under `error`, `e` or `exception`, and `err.message` passed alone or as a field (a dotted ECS key such as `"error.message"` is allowed). It misses loggers under other names and errors stringified first (`String(e)`); look for those in review.
