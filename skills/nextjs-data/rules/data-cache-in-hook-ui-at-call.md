---
title: Cache work in the hook, UI work at the call
impact: HIGH
tags: mutations
check: review
---

## Cache work in the hook, UI work at the call

**Impact: HIGH**

`useMutation({ onSuccess })` updates the cache, and always runs. `mutate(values, { onSuccess })` closes the dialog or navigates, and runs only while the component is still mounted. Mixing them either loses cache updates when the dialog unmounts first, or runs UI work on an unmounted component.

**Correct:**

```tsx
const save = useMutation({ mutationFn, onSuccess: (row) => queryClient.setQueryData(items.get(scope, row.id).queryKey, row) });
save.mutate(values, { onSuccess: () => setOpen(false) });
```
