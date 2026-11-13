---
title: One store per concern
impact: MEDIUM
tags: client-state
check: review
---

## One store per concern

**Impact: MEDIUM**

A selection store, a wizard store, a preferences store. One app-wide store that every page edits couples unrelated features and re-renders more than it should. A store used by one route lives beside it; a shared one in `src/stores/<name>.tsx`.
