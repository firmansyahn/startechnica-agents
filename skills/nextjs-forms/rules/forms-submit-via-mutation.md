---
title: Submit through the mutation, and disable Save while pending
impact: MEDIUM
tags: edit-forms
check: review
---

## Submit through the mutation, and disable Save while pending

**Impact: MEDIUM**

`form.handleSubmit` → `save.mutateAsync(values)` → `runAction` → the action. Save (and Cancel) are disabled with `save.isPending`; no separate `saving` state, no direct action call that bypasses the cache update and error mapping.
