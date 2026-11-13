---
title: The matcher matches the prefix list
impact: MEDIUM
tags: testing
check: review
---

## The matcher matches the prefix list

**Impact: MEDIUM**

A test compares `config.matcher` in `proxy.ts` with the prefix lists the code uses, so adding a backend path in one place and forgetting the other fails.
