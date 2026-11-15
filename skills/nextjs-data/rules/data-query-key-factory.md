---
title: Build query keys from the registry's factory
impact: MEDIUM
tags: tanstack-query, cache, invalidation
check: eslint, review
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags a literal array as `queryKey` in pages, components, hooks and providers (`src/services/` is outside). It misses a key array built in a variable first. Left to review: that the registry's own keys follow `[domain, resource, ...params, scope]`.
