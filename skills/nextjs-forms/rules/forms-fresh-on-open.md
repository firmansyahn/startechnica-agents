---
title: Every open starts from a fresh form state
impact: MEDIUM
tags: edit-forms
check: review
---

## Every open starts from a fresh form state

**Impact: MEDIUM**

Opening for create calls `form.reset(defaults)`; opening for edit `form.reset(toFormValues(row))`. Reusing the previous open's values and errors shows the last record's data in a "new" form.
