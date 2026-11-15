---
title: Changes go through named actions in the store
impact: MEDIUM
tags: client-state
check: eslint, review
---

## Changes go through named actions in the store

**Impact: MEDIUM**

The store defines `toggle`, `clear`, `nextStep`; components call them. `store.setState({...})` from components scatters the state's rules across the app. Server writes are mutations whose `onSuccess` calls the action that follows.

**Incorrect:**

```tsx
onClick={() => useWizard.setState({ step: useWizard.getState().step + 1 })}
```

**Correct:**

```tsx
const next = useWizard((s) => s.next);
onClick={next}
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags `useX.setState(...)` in pages and components. It misses a store reached under another name (a context store's `store.setState`); look for those in review.
