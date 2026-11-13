---
title: Return only what the UI renders
impact: HIGH
tags: actions
check: review
---

## Return only what the UI renders

**Impact: HIGH**

The return value is serialised to the browser. Return the row the API answered with, not raw DB records, tokens, internal ids or the whole session.
