---
title: Closing with unsaved changes asks first
impact: MEDIUM
tags: edit-forms
check: review
---

## Closing with unsaved changes asks first

**Impact: MEDIUM**

When `isDirty`, closing the drawer or leaving through the app's own links asks with the confirm dialog; a tab close or reload is guarded by a `beforeunload` listener added only while dirty. Nothing is asked when nothing changed.
