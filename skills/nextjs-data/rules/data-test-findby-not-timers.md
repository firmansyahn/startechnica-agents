---
title: Wait for data with findBy, not with timers
impact: MEDIUM
tags: testing
check: review
---

## Wait for data with findBy, not with timers

**Impact: MEDIUM**

Use `findBy…`/`waitFor` for anything a query loads; never `setTimeout` or fake timers to "let the query finish".
