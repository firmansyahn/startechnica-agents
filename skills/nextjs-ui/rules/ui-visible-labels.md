---
title: Names come from visible labels
impact: HIGH
tags: accessibility, forms, labels
check: eslint, test, review
---

## Names come from visible labels

**Impact: HIGH** (inputs, icon buttons and landmarks have no accessible name)

Inputs have a `FieldLabel`/`Label` with `htmlFor`; icon-only buttons an `aria-label`; landmarks (`nav`, `main`, `aside`) a label when there's more than one of a kind. Placeholders never replace labels.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports an icon-only `Button` (`size="icon*"`, only icons inside) with no `aria-label`, `aria-labelledby` or `title`, and with `jsx-a11y/label-has-associated-control` a `Label` or `FieldLabel` without `htmlFor`. At runtime, `expectAccessible()` from `assets/tests/axe.ts`, called in each page test, fails on axe's `label`, `button-name`, `link-name` and `select-name` (an input with no label at all, a placeholder-only field). Repeated landmarks and what the page test doesn't render stay review.
