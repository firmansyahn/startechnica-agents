---
title: Names come from visible labels
impact: HIGH
tags: accessibility, forms, labels
check: review
---

## Names come from visible labels

**Impact: HIGH** (inputs, icon buttons and landmarks have no accessible name)

Inputs have a `FieldLabel`/`Label` with `htmlFor`; icon-only buttons an `aria-label`; landmarks (`nav`, `main`, `aside`) a label when there's more than one of a kind. Placeholders never replace labels.

**How to check:** look for inputs without a `Label`/`FieldLabel` `htmlFor`, placeholder-only fields, and repeated landmarks without a label.
