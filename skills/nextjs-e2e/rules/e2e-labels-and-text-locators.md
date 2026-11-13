---
title: Labels for fields, text for static content, test ids last
impact: LOW
tags: locators
check: review
---

## Labels for fields, text for static content, test ids last

**Impact: LOW**

Order of preference: `getByRole`, `getByLabel` (form fields), `getByPlaceholder` only if the field has no label (then fix the label), `getByText` (non-interactive content), `getByTestId` only for things with no role or name (a chart canvas, a live counter you mask). Needing a test id for a button means the button has no accessible name: fix that.
