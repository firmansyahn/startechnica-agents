---
title: Scope-bound stores reset with the query cache
impact: MEDIUM
tags: client-state
check: review
---

## Scope-bound stores reset with the query cache

**Impact: MEDIUM**

A selection, draft or filter tied to a tenant or workspace is reset when the scope changes and on sign-out: provider stores by the same remount `key` that resets the query cache, module stores by a `reset` action (`set(store.getInitialState(), true)`) called from the same provider-level listener.
