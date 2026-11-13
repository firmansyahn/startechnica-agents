---
title: Clear the cache once, at the provider, on a scope switch
impact: HIGH
tags: tanstack-query, multi-tenant, cache
check: review
---

## Clear the cache once, at the provider, on a scope switch

**Impact: HIGH** (data from the previous tenant or workspace shows after switching)

When the active tenant/workspace changes, one provider-level listener removes all queries and remounts the subtree. Pages don't add their own listeners, and sign-out clears the whole client.

**Incorrect:**

```tsx
// in a page
useEffect(() => onTenantSwitch(() => refetch()), []);
```

**Correct:**

```tsx
// in the area's providers.tsx, once
useEffect(() => onTenantSwitch(() => { queryClient.removeQueries(); setEpoch((n) => n + 1); }), [queryClient]);
return <Fragment key={epoch}>{children}</Fragment>;
```

**How to check:** grep for the scope-switch subscription; it should appear only in the provider.
