---
title: Query options come from the services registry
impact: HIGH
tags: queries
check: eslint
---

## Query options come from the services registry

**Impact: HIGH**

`src/services/<domain>/index.ts` exports `queryOptions()` objects. Components spread them and add only view options (`enabled`, `select`, `placeholderData`). Don't write `queryKey` + `queryFn` pairs inside a component.

**Incorrect:**

```tsx
useQuery({ queryKey: ["items", scope], queryFn: () => read<Item[]>("items", { scope }) });
```

**Correct:**

```tsx
useQuery({ ...items.list(scope, params), placeholderData: keepPreviousData });
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags any `queryFn` in pages, components, hooks and providers; the registry in `src/services/` is outside, and `mutationFn` isn't matched.
