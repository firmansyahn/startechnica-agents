---
title: Don't wrap code in try/catch just to log
impact: MEDIUM
tags: errors
check: review
---

## Don't wrap code in try/catch just to log

**Impact: MEDIUM**

An unexpected error that is caught, logged and rethrown is logged twice; one caught and swallowed hides a bug. Let it reach `onRequestError` (or the error boundary). Catch only to turn an expected failure into a `Result` or a fallback.

**Incorrect:**

```ts
try { return await getItem(id); } catch (e) { log.error({ err: e }, "getItem failed"); throw e; }
```

**Correct:**

```ts
return await getItem(id);   // an unexpected failure reaches onRequestError
```
