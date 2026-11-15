---
title: Go through the services registry, not fetch, in pages and components
impact: HIGH
tags: services, bff, data-fetching
check: scan, eslint
---

## Go through the services registry, not fetch, in pages and components

**Impact: HIGH** (auth, scope headers, error shapes and query keys drift per page)

Pages and components never call `fetch` (or axios) for app data. Reads use query options from `src/services/<domain>/index.ts`; writes call server actions from `src/services/<domain>/actions.ts`. File uploads and downloads use the shared upload/download helpers.

**Incorrect:**

```tsx
const res = await fetch(`/app/api/billing/invoices?page=${page}`, { headers: { "Tenant-ID": tenant } });
```

**Correct:**

```tsx
const invoices = useQuery(billing.invoices(tenant, { page }));
```

**How to check:** `assets/eslint.config.mjs` bans the `fetch` global and `axios` imports in `app/` and `components/` (route handlers excepted). `scripts/scan.sh` flags `fetch(` and `axios` there too.
