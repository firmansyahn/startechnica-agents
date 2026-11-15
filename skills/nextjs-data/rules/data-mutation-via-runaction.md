---
title: mutationFn calls one action through runAction
impact: HIGH
tags: mutations
check: test
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

**How to check:** `assets/tests/action-calls.test.ts` fails on a call of an imported action in `app`, `components` or `src/hooks` that sits in a `mutationFn` but not inside `runAction(...)`, and on a bare `mutationFn: saveItem`; the file, line and fix are in the message. A project wrapper that unwraps the Result itself goes in the test's `UNWRAP_CALLS`. It misses an action passed through a variable or prop before it is called.
