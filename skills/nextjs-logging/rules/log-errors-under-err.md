---
title: Errors go in err
impact: MEDIUM
tags: logging
check: review
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
