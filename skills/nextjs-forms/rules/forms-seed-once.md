---
title: Seed the form once per record
impact: MEDIUM
tags: edit-forms
check: review
---

## Seed the form once per record

**Impact: MEDIUM**

Read the record with `staleTime: Infinity, refetchOnWindowFocus: false`, and `form.reset(toFormValues(row))` once per record id (a ref remembers which id was seeded). Resetting on every `data` change wipes the user's typing when a background refetch lands.

**Incorrect:**

```tsx
useEffect(() => { if (item.data) form.reset(item.data); }, [item.data]);
```

**Correct:**

```tsx
const seeded = useRef<string | null>(null);
useEffect(() => {
  if (item.data && seeded.current !== item.data.id) {
    form.reset(toFormValues(item.data));
    seeded.current = item.data.id;
  }
}, [item.data, form]);
```
