---
title: Tests query by role and name
impact: LOW
tags: accessibility, testing
check: review
---

## Tests query by role and name

**Impact: LOW** (elements only a test id can find are invisible to assistive technology too)

`getByRole("button", { name: "Save" })`, `getByRole("dialog", { name: "Edit customer" })`, `getByLabelText("Email")`. If a test can only find an element by test id or class, users of assistive technology can't find it either.

**How to check:** search tests for `getByTestId`, `container.querySelector` and class selectors.
