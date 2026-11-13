---
title: Never set store state during render
impact: MEDIUM
tags: client-state
check: review
---

## Never set store state during render

**Impact: MEDIUM**

`setState` (or an action) called while rendering runs on the server for every request and again on every client render. Seed through the provider's initial prop; change state from event handlers or effects.
