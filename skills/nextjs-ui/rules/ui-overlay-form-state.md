---
title: Forms in overlays keep their state on failure and reset on open
impact: MEDIUM
tags: overlays, forms
check: test, review
---

## Forms in overlays keep their state on failure and reset on open

**Impact: MEDIUM** (a refusal loses the user's input, or the next open shows the last record's values)

On failure the overlay stays open with the errors shown inside it. Opening for create resets to defaults; opening for edit resets to the record. Closing with unsaved changes asks first.

**How to check:** `assets/tests/form-overlay.test.tsx`, copied beside the project's form drawer or dialog composite with its harness adapted, checks that a refused save keeps it open with the refusal inside and the input kept, that opening for create shows the defaults after an edit, that opening for edit shows the record after a create, and that closing with unsaved changes asks first. Overlays built by hand instead of on the composite stay review (`page-form-drawer-composite`).
