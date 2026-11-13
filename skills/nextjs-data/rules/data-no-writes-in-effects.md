---
title: No writes in effects or on render
impact: HIGH
tags: mutations
check: review
---

## No writes in effects or on render

**Impact: HIGH**

A write runs from a user event (submit, click, confirm). A mutation fired from `useEffect` runs twice under Strict Mode, again on every remount, and can't be confirmed or undone.
