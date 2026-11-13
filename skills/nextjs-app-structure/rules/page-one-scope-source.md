---
title: One page, one scope source
impact: MEDIUM
tags: pages
check: review
---

## One page, one scope source

**Impact: MEDIUM**

The page reads the active tenant/workspace from the one provider hook (`useActiveTenant()`), passes it to every query and every write's input, and never keeps its own copy in state or reads it from the URL in some places and the provider in others.
