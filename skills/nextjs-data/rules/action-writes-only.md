---
title: Use server actions for writes only, one at a time
impact: MEDIUM
tags: server-actions, performance
check: review
---

## Use server actions for writes only, one at a time

**Impact: MEDIUM** (reads through actions queue behind each other; parallel actions run serially anyway)

The client dispatches actions sequentially. Reads go through Server Components or TanStack Query; batch work goes inside one action or one backend call, not `Promise.all` over actions. Uploads use a route handler (actions are capped at 1 MB and can't stream).

**Incorrect:**

```tsx
const { data } = useQuery({ queryKey: ["items"], queryFn: () => listItemsAction() });
await Promise.all(ids.map((id) => deleteItem({ id })));
```

**Correct:**

```tsx
const { data } = useQuery(items.list(scope, params));
await runAction(() => deleteItems({ ids, scope }));      // one action, one backend call
```

**How to check:** look for actions called from `queryFn`, `useEffect` or `Promise.all`, and for `File`/`Blob` in action inputs.
