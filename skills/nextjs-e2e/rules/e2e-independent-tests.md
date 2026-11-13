---
title: Tests don't depend on order or on each other
impact: LOW
tags: stability
check: review
---

## Tests don't depend on order or on each other

**Impact: LOW**

Each test sets up its own data and state; `fullyParallel: true` and `--repeat-each` pass. `test.describe.serial` only for a deliberate multi-step journey, never to paper over shared data.
