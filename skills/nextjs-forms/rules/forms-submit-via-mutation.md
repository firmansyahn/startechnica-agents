---
title: Submit through the mutation, and disable Save while pending
impact: MEDIUM
tags: edit-forms
check: test, review (Save and Cancel disabled while pending)
---

## Submit through the mutation, and disable Save while pending

**Impact: MEDIUM**

`form.handleSubmit` → `save.mutateAsync(values)` → `runAction` → the action. Save (and Cancel) are disabled with `save.isPending`; no separate `saving` state, no direct action call that bypasses the cache update and error mapping.

**How to check:** `nextjs-data`'s `assets/tests/action-calls.test.ts` fails on a server action called in a component, page or hook outside a `mutationFn` (a direct call from a submit handler, even through `runAction`); the file, line and fix are in the message. Review the saving state: Save and Cancel disabled with `save.isPending`, no separate `saving` flag (`data-ispending-for-buttons`).
