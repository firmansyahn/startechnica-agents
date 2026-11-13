---
title: Never log headers wholesale
impact: HIGH
tags: redaction
check: review
---

## Never log headers wholesale

**Impact: HIGH**

Log the few headers you need through an allow-list (`safeHeaders(h)`: `content-type`, `user-agent`, `x-request-id`). Redaction is the safety net, not the plan.

**Incorrect:**

```ts
log.warn({ headers: Object.fromEntries(req.headers) }, "refused");
```

**Correct:**

```ts
log.warn({ headers: safeHeaders(req.headers) }, "refused");
```
