---
title: Cards group, they don't decorate
impact: LOW
tags: layout, cards
check: eslint, review
---

## Cards group, they don't decorate

**Impact: LOW** (nested and page-wide cards add borders without adding structure)

A `Card` frames one unit (a settings section, a stat, a record summary) with its header. Don't nest cards in cards, and don't wrap a whole page in one card.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports a `Card` inside a `Card` in one file. Nesting across files and a whole page wrapped in one card stay review.
