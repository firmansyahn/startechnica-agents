---
title: The write names its scope
impact: HIGH
tags: mutations
check: review
---

## The write names its scope

**Impact: HIGH**

A Server Action can't see client state such as the tenant picked in a header selector, so the mutation passes the scope in the action's input, and the action passes it on for the backend to check.

**Incorrect:**

```tsx
mutationFn: (v) => runAction(() => saveItem(v)),   // the action guesses the tenant
```

**Correct:**

```tsx
mutationFn: (v) => runAction(() => saveItem({ ...v, scope })),
```
