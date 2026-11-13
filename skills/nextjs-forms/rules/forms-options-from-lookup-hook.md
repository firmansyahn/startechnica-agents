---
title: Options come from a shared lookup hook
impact: MEDIUM
tags: fields
check: review
---

## Options come from a shared lookup hook

**Impact: MEDIUM**

A select's or combobox's options come from the shared lookup hook (`useCustomerNames()`), never from a fetch or a query written inside the form. A long or searchable list is a combobox whose text drives a query with `keepPreviousData`; the form stores the id, not the label.
