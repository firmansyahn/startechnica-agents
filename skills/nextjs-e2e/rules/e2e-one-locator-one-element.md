---
title: One locator, one element
impact: LOW
tags: locators
check: eslint
---

## One locator, one element

**Impact: LOW**

Playwright's strict mode throws when a locator matches several elements during an action. Narrow it (scope, `exact: true`, a fuller name) instead of `.first()`; `.first()`/`.nth()` hide a page that suddenly renders two of something.

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) turns on `playwright/no-nth-methods` in `tests/**/*.spec.ts`, which flags `.first()`, `.last()` and `.nth()`. A deliberate one (the third row of a table spec) takes a disable comment with the reason.
