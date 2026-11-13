---
title: Error pages show the digest, never the server's message
impact: MEDIUM
tags: errors
check: review
---

## Error pages show the digest, never the server's message

**Impact: MEDIUM**

`error.tsx` renders the error state composite with `error.digest` as a reference ("Reference: 3141592653") and a retry (`reset`). Production replaces a server error's message with a generic one, and a page built to show `error.message` shows internals in every other environment. `error.tsx` doesn't log server errors (already logged); it reports client render errors.

**Incorrect:**

```tsx
return <p>{error.message}</p>;
```

**Correct:**

```tsx
return <ErrorState title={t("somethingWentWrong")} reference={error.digest} onRetry={reset} />;
```
