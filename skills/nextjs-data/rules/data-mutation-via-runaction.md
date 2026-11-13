---
title: mutationFn calls one action through runAction
impact: HIGH
tags: mutations
check: review
---

## mutationFn calls one action through runAction

**Impact: HIGH**

`runAction` turns a failed `Result` into a thrown `ApiError`, so `onError`, `isError` and the form's field errors work. Calling the action bare leaves a failed `Result` looking like a success.

**Incorrect:**

```tsx
useMutation({ mutationFn: (v: ItemInput) => saveItem(v) });   // { ok: false } resolves; onSuccess runs
```

**Correct:**

```tsx
useMutation({ mutationFn: (v: ItemInput) => runAction(() => saveItem({ ...v, scope })) });
```
