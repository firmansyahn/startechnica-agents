---
title: Expected failures are results, not errors
impact: MEDIUM
tags: errors
check: review
---

## Expected failures are results, not errors

**Impact: MEDIUM**

A refused write (422, 403, 409) is a `Result` shown to the user and logged at most at `warn` by the shared helper. A backend that's down is `warn` with the status. Only bugs and broken invariants are `error`, because `error` pages someone.
