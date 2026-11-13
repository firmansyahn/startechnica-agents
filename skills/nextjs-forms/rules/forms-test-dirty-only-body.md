---
title: An edit sends only the changed fields
impact: LOW
tags: testing
check: review
---

## An edit sends only the changed fields

**Impact: LOW**

Load a record, change one field, save, and assert the PATCH body has exactly that key. A test that only checks "a PATCH happened" misses a form that sends everything.
