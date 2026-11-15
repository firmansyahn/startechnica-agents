---
title: No writes in effects or on render
impact: HIGH
tags: mutations
check: test, review (writes during render)
---

## No writes in effects or on render

**Impact: HIGH**

A write runs from a user event (submit, click, confirm). A mutation fired from `useEffect` runs twice under Strict Mode, again on every remount, and can't be confirmed or undone.

**How to check:** `assets/tests/no-effect-fetch.test.ts` fails on a `useEffect` that calls a server action or fires a mutation (`save.mutate(v)`, `mutateAsync(v)`, a `mutate` destructured from a mutation hook), directly or through one of the file's own functions; a deliberate one goes in its `EXEMPT` list with the reason. It misses a write hidden behind another hook or a callback prop; review those, and writes made during render.
