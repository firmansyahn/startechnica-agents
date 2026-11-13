---
title: Keyboard paths are tested explicitly
impact: MEDIUM
tags: scope-and-ci
check: review
---

## Keyboard paths are tested explicitly

**Impact: MEDIUM**

At least one spec per main flow uses only the keyboard: Tab to the control, Enter/Space to act, Escape to close, focus back on the trigger (`toBeFocused()`). Axe doesn't check these.
