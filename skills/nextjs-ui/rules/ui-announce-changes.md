---
title: Errors and changes are announced
impact: MEDIUM
tags: accessibility, live-regions, forms
check: review
---

## Errors and changes are announced

**Impact: MEDIUM** (screen-reader users miss field errors and async results)

Field errors render with `role="alert"` (the `FieldError` part does) and the control has `aria-invalid`. Live counts or async results that matter use `aria-live="polite"` regions; toasts are announced by the toaster.

**How to check:** check field errors render through `FieldError` with `aria-invalid` on the control, and important async results sit in an `aria-live` region.
