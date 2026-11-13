---
title: Filters are URL state, not a form
impact: MEDIUM
tags: edit-forms
check: review
---

## Filters are URL state, not a form

**Impact: MEDIUM**

A list's filters live in the URL (`useSearchParams` + `router.replace`, text debounced), so the view is shareable and survives reloads; they go into the list's query key. One or two filter inputs don't need a `useForm`.
