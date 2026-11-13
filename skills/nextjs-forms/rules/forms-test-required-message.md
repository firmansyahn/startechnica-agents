---
title: An empty required field shows its message and sends nothing
impact: LOW
tags: testing
check: review
---

## An empty required field shows its message and sends nothing

**Impact: LOW**

Submit with the field empty, expect the message near the field (`findByText` or the field's `aria-invalid`) and no recorded call.
