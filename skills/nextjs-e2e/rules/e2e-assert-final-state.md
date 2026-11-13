---
title: Assert the final state, not an intermediate one
impact: LOW
tags: stability
check: review
---

## Assert the final state, not an intermediate one

**Impact: LOW**

After a write the list refetches; a toast appears and fades. Assert what stays (the row with the new value), not the brief "Saving…" label or the toast's exit.
