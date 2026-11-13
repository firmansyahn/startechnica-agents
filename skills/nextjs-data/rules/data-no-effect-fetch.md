---
title: Read server data with useQuery, never useEffect + fetch
impact: HIGH
tags: tanstack-query, data-fetching, effects
check: test
---

## Read server data with useQuery, never useEffect + fetch

**Impact: HIGH** (race conditions, no caching or deduplication, stale data after writes, hand-rolled loading and error state)

Client components read through TanStack Query with the services registry's query options. A `useEffect` that fetches and sets state, directly or through a `load()` it calls, is not allowed; neither is SWR.

**Incorrect:**

```tsx
const [items, setItems] = useState<Item[]>([]);
useEffect(() => { load(); }, [scope]);
async function load() { setItems(await (await fetch(`/api/items?scope=${scope}`)).json()); }
```

**Correct:**

```tsx
const list = useQuery({ ...items.list(scope, params), enabled: scope !== null });
```

**How to check:** `assets/tests/no-effect-fetch.test.ts` (copied to `<app-root>/tests/`) fails on a `useEffect` that fetches, directly, through the file's own functions, through an exported helper that fetches, or through a server action; its `EXEMPT` list (file + reason) only shrinks. `scripts/scan.sh` flags candidates.
