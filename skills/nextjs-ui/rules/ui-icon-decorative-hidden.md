---
title: Decorative icons stay hidden from screen readers
impact: LOW
tags: icons, accessibility
check: review
---

## Decorative icons stay hidden from screen readers

**Impact: LOW** (screen readers read the same thing twice)

An icon next to text that says the same thing is decorative: lucide icons render `aria-hidden="true"` by default, so don't add a `title` or `aria-label` to them.

**How to check:** look for `title` or `aria-label` on icons that sit next to text saying the same thing.
