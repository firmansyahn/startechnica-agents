---
title: Toasts for outcomes, not for questions or form errors
impact: MEDIUM
tags: overlays, toasts, forms
check: review
---

## Toasts for outcomes, not for questions or form errors

**Impact: MEDIUM** (a question or a field error disappears before the user can act on it)

Toast "Customer saved", "Export started". Field errors and refusals of an open form appear inside the form. A toast never asks a question or holds the only copy of something the user must act on. Mount the toaster once, above overlays, following the theme.

**How to check:** look for `toast(...)` calls carrying field errors, refusals of an open form, or anything that needs an answer.
