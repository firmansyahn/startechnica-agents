---
title: Assert on what the user sees, not on implementation
impact: LOW
tags: locators
check: review
---

## Assert on what the user sees, not on implementation

**Impact: LOW**

Check the toast, the row in the list, the URL, the field error under the field. Not the request count, a store's state or a class name, unless the spec is about exactly that (a header check, a no-duplicate-request check).
