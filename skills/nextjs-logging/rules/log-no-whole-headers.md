---
title: Never log headers wholesale
impact: HIGH
tags: redaction
check: eslint, review
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags, inside a `log`/`logger` call in app code, `Object.fromEntries(...)`, a field whose value is `x.headers`, a spread of `x.headers`, and `x.headers` passed as an argument. It misses a headers object built earlier and passed by variable; look for those in review.
