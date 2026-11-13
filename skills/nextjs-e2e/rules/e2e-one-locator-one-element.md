---
title: One locator, one element
impact: LOW
tags: locators
check: review
---

## One locator, one element

**Impact: LOW**

Playwright's strict mode throws when a locator matches several elements during an action. Narrow it (scope, `exact: true`, a fuller name) instead of `.first()`; `.first()`/`.nth()` hide a page that suddenly renders two of something.
