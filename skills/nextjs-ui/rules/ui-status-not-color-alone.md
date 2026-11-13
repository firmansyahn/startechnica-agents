---
title: Status is never shown by icon or color alone
impact: MEDIUM
tags: accessibility, status, icons
check: review
---

## Status is never shown by icon or color alone

**Impact: MEDIUM** (color-blind users and screen readers can't tell the statuses apart)

A status shows its label (visible or as `aria-label`) next to its icon or color dot, so color-blind users and screen readers get it.

**How to check:** look for status dots, icons or colored badges with no visible label and no `aria-label`.
