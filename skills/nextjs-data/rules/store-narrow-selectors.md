---
title: Select the smallest slice; useShallow for objects and arrays
impact: MEDIUM
tags: client-state
check: review
---

## Select the smallest slice; useShallow for objects and arrays

**Impact: MEDIUM**

A component re-renders when its selected value changes by `Object.is`. Calling the hook without a selector, or with a selector that builds a new object each time, re-renders on every store change.

**Incorrect:**

```tsx
const { ids, clear } = useSelectionStore();                             // whole store
const view = useSelection((s) => ({ ids: s.ids, clear: s.clear }));    // new object every call
```

**Correct:**

```tsx
const count = useSelection((s) => s.ids.length);
const { ids, clear } = useSelection(useShallow((s) => ({ ids: s.ids, clear: s.clear })));
```
