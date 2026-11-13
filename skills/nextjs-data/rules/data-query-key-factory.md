---
title: Build query keys from the registry's factory
impact: MEDIUM
tags: tanstack-query, cache, invalidation
check: review
---

## Build query keys from the registry's factory

**Impact: MEDIUM** (invalidation misses variants; two components cache the same data under different keys)

Keys are `[domain, resource, ...params, scope]`, built by the registry (`items.key(scope)`, `items.list(...).queryKey`). Inline key arrays in components drift from the factory and stop invalidations reaching them.

**Incorrect:**

```tsx
useQuery({ queryKey: ["items", tenant, page], queryFn: ... });
queryClient.invalidateQueries({ queryKey: ["item-list"] });
```

**Correct:**

```tsx
useQuery(items.list(tenant, { page }));
queryClient.invalidateQueries({ queryKey: items.key(tenant) });
```

**How to check:** look for `queryKey: [` and `invalidateQueries({ queryKey: [` with literal arrays outside `src/services/`.
