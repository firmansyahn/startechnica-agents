---
title: Decide the caching of every read that relied on the old defaults
impact: HIGH
tags: upgrade, next-15, app-router, caching
check: review
---

## Decide the caching of every read that relied on the old defaults

**Impact: HIGH** (the build passes while pages either hit the backend on every request or keep serving data that used to refresh)

Next 15 changed three App Router defaults:

- `fetch` is no longer cached;
- `GET` route handlers are no longer cached;
- the client router cache no longer reuses page segments on navigation.

Code written for 13 or 14 may rely on the old behaviour without saying so. For each server read and each `GET` handler, write the intent down: `cache: "force-cache"`, `next: { revalidate: n }`, segment `revalidate` or `dynamic`, or uncached on purpose. Compare backend request rates and page freshness with the baseline. Don't switch on Cache Components to restore caching (`upgrade-no-new-defaults`).

**Incorrect:**

```tsx
// app/catalog/page.tsx: cached by default on 14, fetched on every request on 15
const products = await fetch("https://api.example.com/products").then((r) => r.json());
```

**Correct:**

```tsx
// cached for 10 minutes, as before the upgrade (the intent is now in the code)
const products = await fetch("https://api.example.com/products", { next: { revalidate: 600 } }).then((r) => r.json());
```

**How to check:** in review, list the `fetch` calls in Server Components and the `GET` route handlers under `app/` that set no `cache`, `next.revalidate`, `revalidate` or `dynamic`, and confirm each one. Compare the backend's request rate before and after on staging (`upgrade-rollout-with-rollback`).
