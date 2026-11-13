---
title: Keep server data in TanStack Query, never copied into a client store
impact: HIGH
tags: zustand, tanstack-query, client-state, cache
check: review
---

## Keep server data in TanStack Query, never copied into a client store

**Impact: HIGH** (a second cache that goes stale after every write, refetch and scope switch; per-user data leaking between requests when the store is module-level)

Client stores (Zustand, context) hold client-only state: selections, wizard drafts, UI flags, per-device preferences. Records from the backend stay in the query cache; the store keeps ids and choices, and components read the records from the query.

**Incorrect:**

```tsx
const { data } = useQuery(items.list(scope, params));
const setItems = useItemsStore((s) => s.setItems);
useEffect(() => { if (data) setItems(data.rows); }, [data, setItems]);
```

**Correct:**

```tsx
const rows = useQuery(items.list(scope, params)).data?.rows ?? [];
const ids = useSelection((s) => s.ids);
const selected = rows.filter((r) => ids.includes(r.id));
```

**How to check:** in review, open every store (`create(`, `createStore(` from `zustand`) in the diff and every place that calls its setters: a field holding rows, records or the signed-in user, or a setter fed from `useQuery` data or an action's result, is a finding. Also check module-level stores aren't written during render (`nextjs-data` Client state rules).
