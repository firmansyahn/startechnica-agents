---
title: Use server actions for writes only, one at a time
impact: MEDIUM
tags: server-actions, performance
check: test, scan, review (sequential loops of actions)
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

**How to check:** `assets/tests/action-calls.test.ts` fails on an action (a name imported from an `actions` module) called in a `queryFn` or in `Promise.all`/`Promise.allSettled`, and `assets/tests/no-effect-fetch.test.ts` on one called in a `useEffect`. `scripts/scan.sh` lists `z.file()`, `z.instanceof(File)`/`Blob` and `instanceof File` in "use server" files and the schemas they import (uploads through an action). Review the rest: actions called one after another in a loop, and an action passed through a variable or prop before it is called.
