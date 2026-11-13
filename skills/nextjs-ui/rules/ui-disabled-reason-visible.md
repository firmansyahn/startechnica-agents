---
title: Disabled is never the only explanation
impact: MEDIUM
tags: states, accessibility
check: review
---

## Disabled is never the only explanation

**Impact: MEDIUM** (users can't find out why they can't act, and a tooltip on a disabled control never shows)

A disabled button whose reason isn't obvious has visible helper text or a description (`aria-describedby`) saying why ("Select at least one row", "Read-only access"). Disabled elements don't receive focus, so a tooltip alone isn't enough.

**How to check:** look for disabled controls whose reason isn't visible text or `aria-describedby`.
