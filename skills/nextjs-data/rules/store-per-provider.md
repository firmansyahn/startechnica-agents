---
title: A store is created per provider, not per module, when it can hold per-user state
impact: MEDIUM
tags: client-state
check: review
---

## A store is created per provider, not per module, when it can hold per-user state

**Impact: MEDIUM**

During server rendering one module instance serves every request, so a module-level `create()` store that is written on the server leaks state between users. Create the store with `createStore` inside a provider (`useState(() => createXStore(initial))`) and read it with `useStore(store, selector)` through context.

**Incorrect:**

```tsx
export const useCartStore = create<Cart>()((set) => ({ items: [], add: (i) => set((s) => ({ items: [...s.items, i] })) }));
// a server component's child seeds it during render:
useCartStore.setState({ items: initialItems });
```

**Correct:**

```tsx
<CartProvider initial={initialItems}>{children}</CartProvider>   // createStore per mount; seeded through the prop
```
