---
title: Never set store state during render
impact: MEDIUM
tags: client-state
check: eslint, review
---

## Never set store state during render

**Impact: MEDIUM**

`setState` (or an action) called while rendering runs on the server for every request and again on every client render. Seed through the provider's initial prop; change state from event handlers or effects.

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags `setState(...)` and `useX.getState().action()` as a top-level statement in a component's body (a capitalised function or arrow) in pages and components. It misses a call under an `if` in render, a store action reached by a hook (`const reset = useX((s) => s.reset); reset();`) and components wrapped in `memo` or `forwardRef`; look for those in review.
