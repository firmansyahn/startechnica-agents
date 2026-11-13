---
title: Read-only users get disabled controls
impact: MEDIUM
tags: fields
check: review
---

## Read-only users get disabled controls

**Impact: MEDIUM**

Pass `disabled` to every control (or wrap them in `<fieldset disabled>`), keep the values readable, and show Save disabled through the write-aware button, or not at all. The form becomes a view, not an editor that fails on submit.
