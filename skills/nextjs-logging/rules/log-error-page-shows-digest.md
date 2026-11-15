---
title: Error pages show the digest, never the server's message
impact: MEDIUM
tags: errors
check: scan, review
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

**How to check:** `scripts/scan.sh` flags each `error.*`/`global-error.*` under `app/` or `src/app/` that renders `error.message` (or `err.message`), and each that never mentions `digest`. A client report sending `error.message` from the boundary is flagged too: confirm each line. Review that the page doesn't log server errors itself.
