---
title: Edit forms read once and are never overwritten by a refetch
impact: HIGH
tags: queries
check: review
---

## Edit forms read once and are never overwritten by a refetch

**Impact: HIGH**

The record behind an edit form is read with `staleTime: Infinity, refetchOnWindowFocus: false`, and the form is seeded once per record id. Seeding on every `data` change wipes what the user typed when a background refetch lands.

**Incorrect:**

```tsx
const { data } = useQuery(items.get(scope, id));
useEffect(() => { if (data) form.reset(data); }, [data]);
```

**Correct:**

```tsx
const item = useQuery({ ...items.get(scope, id), staleTime: Infinity, refetchOnWindowFocus: false });
const seeded = useRef<string | null>(null);
useEffect(() => {
  if (item.data && seeded.current !== item.data.id) {   // once per record
    form.reset(toFormValues(item.data));
    seeded.current = item.data.id;
  }
}, [item.data, form]);
```

The full edit-form pattern (dirty fields only, reset after save) is in `nextjs-forms`.
