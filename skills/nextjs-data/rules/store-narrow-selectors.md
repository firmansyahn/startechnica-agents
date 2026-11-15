---
title: Select the smallest slice; useShallow for objects and arrays
impact: MEDIUM
tags: client-state
check: test
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

**How to check:** `assets/tests/stores.test.ts` fails on a call of a store hook (a module store `export const useX = create(...)`, or a provider store's hook that passes its selector to `useStore`) with no selector or `(s) => s`, on a selector that builds an object or array (`=> ({`, `=> [`, `.map(`, `.filter(`) without `useShallow`, and on `useStore(store)` without a selector. It misses a store hook re-exported under another name.
