---
title: Cards group, they don't decorate
impact: LOW
tags: layout, cards
check: review
---

## Cards group, they don't decorate

**Impact: LOW** (nested and page-wide cards add borders without adding structure)

A `Card` frames one unit (a settings section, a stat, a record summary) with its header. Don't nest cards in cards, and don't wrap a whole page in one card.

**How to check:** look for `Card` inside `Card` and for a whole page wrapped in one card.
