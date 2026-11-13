---
title: Changes go through named actions in the store
impact: MEDIUM
tags: client-state
check: review
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
