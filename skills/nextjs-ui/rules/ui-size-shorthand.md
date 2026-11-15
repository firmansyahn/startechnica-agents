---
title: size-* when width and height match
impact: LOW
tags: tailwind, classes
check: test
---

## `size-*` when width and height match

**Impact: LOW** (two classes where one says it, and they drift apart when one is edited)

**Incorrect:** `<Avatar className="w-10 h-10" />`

**Correct:** `<Avatar className="size-10" />`

**How to check:** `assets/tests/size-shorthand.test.ts` fails on a `w-N` and an `h-N` with the same variant prefix and value in one string literal (template literals included), with the `size-N` to use; generated primitives are skipped and an `ALLOWED` list with reasons fails when stale. A pair split across two strings (`cn("w-4", "h-4")`) isn't seen.
