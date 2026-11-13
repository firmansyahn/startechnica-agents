---
title: Reset to the saved row after a successful save
impact: MEDIUM
tags: edit-forms
check: review
---

## Reset to the saved row after a successful save

**Impact: MEDIUM**

`form.reset(toFormValues(row))` with the row the write answered with makes it the new baseline, so `isDirty` is false again and the next edit's PATCH contains only the new changes.
