---
title: Don't turn on new features to finish an upgrade
impact: MEDIUM
tags: upgrade, scope, cache-components
check: scan
---

## Don't turn on new features to finish an upgrade

**Impact: MEDIUM** (Cache Components, Partial Prefetching and the React Compiler change rendering and caching across the app, in the same diff as the version changes)

The upgrade reproduces today's behaviour on the new version. `cacheComponents`, `partialPrefetching`, `ppr` and `reactCompiler` stay off unless the app already had them. Turning one on is its own change after the upgrade, with its own guide (`migrating-to-cache-components.md`). The team's apps don't use Cache Components (`nextjs-new-app`).

**Incorrect:**

```ts
const nextConfig = { cacheComponents: true, reactCompiler: true }; // added during the upgrade
```

**Correct:**

```ts
const nextConfig = {}; // same features as before; Cache Components is a later, separate decision
```

**How to check:** `scripts/scan.sh` flags these keys in `next.config.*`. Confirm against the baseline whether the app had them before.
