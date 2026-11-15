---
title: Optimistic updates only where they pay, with a rollback
impact: HIGH
tags: mutations
check: test (the shape), review (where an optimistic update pays)
---

## Optimistic updates only where they pay, with a rollback

**Impact: HIGH**

Use them for toggles and reordering, where latency is visible and failure is rare; not for creates or anything the server may refuse for a reason the user must read. `onMutate` cancels in-flight queries for the key, snapshots and sets; `onError` restores the snapshot; `onSettled` invalidates.

**Correct:**

```tsx
useMutation({
  mutationFn: (v) => runAction(() => setEnabled({ ...v, scope })),
  onMutate: async (v) => {
    await queryClient.cancelQueries({ queryKey: items.key(scope) });
    const before = queryClient.getQueryData(items.get(scope, v.id).queryKey);
    queryClient.setQueryData(items.get(scope, v.id).queryKey, (row) => row && { ...row, enabled: v.enabled });
    return { before };
  },
  onError: (_e, v, ctx) => queryClient.setQueryData(items.get(scope, v.id).queryKey, ctx?.before),
  onSettled: () => queryClient.invalidateQueries({ queryKey: items.key(scope) }),
});
```

**How to check:** `assets/tests/optimistic-updates.test.ts` fails on a mutation (`useMutation`, the project's `use...Mutation` wrappers, `mutationOptions`) whose `onMutate` calls `setQueryData` without also calling `cancelQueries` there, having an `onError`, and invalidating in `onSettled`. It misses options built in a variable first, and doesn't check that `onError` restores the right snapshot. Whether the update should be optimistic at all (a toggle, not a create) stays review.
