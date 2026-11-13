---
title: Each test creates its own data, with a unique name
impact: MEDIUM
tags: data-and-auth
check: review
---

## Each test creates its own data, with a unique name

**Impact: MEDIUM**

Create records in the test (through the API or the fake backend), name them uniquely (`` `Customer ${testInfo.testId.slice(0, 8)}` ``), and find them by that name. Never rely on "the first row" of a shared list or on another test's leftovers.
