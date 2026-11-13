---
title: Update the cache after every write
impact: HIGH
tags: tanstack-query, mutations, cache
check: review
---

## Update the cache after every write

**Impact: HIGH** (the user saves and still sees the old data)

A mutation's `onSuccess` either puts the returned row in the cache (`setQueryData`) or invalidates the narrowest key covering what changed. Manual `refetch()` calls and page reloads are not a substitute.

**Incorrect:**

```tsx
const save = useMutation({ mutationFn: (v) => runAction(() => saveItem(v)) });
save.mutate(values, { onSuccess: () => window.location.reload() });
```

**Correct:**

```tsx
const save = useMutation({
  mutationFn: (v: ItemInput) => runAction(() => saveItem({ ...v, scope })),
  onSuccess: (row) => {
    queryClient.setQueryData(items.get(scope, row.id).queryKey, row);
    return queryClient.invalidateQueries({ queryKey: items.key(scope) });
  },
});
```

**How to check:** every `useMutation` has an `onSuccess` that touches the cache (or a comment saying why not); no `location.reload()` after writes.
