---
title: Forms in overlays keep their state on failure and reset on open
impact: MEDIUM
tags: overlays, forms
check: review
---

## Forms in overlays keep their state on failure and reset on open

**Impact: MEDIUM** (a refusal loses the user's input, or the next open shows the last record's values)

On failure the overlay stays open with the errors shown inside it. Opening for create resets to defaults; opening for edit resets to the record. Closing with unsaved changes asks first.

**How to check:** check that a failed save keeps the overlay open with its errors, and that opening resets to defaults or the record.
