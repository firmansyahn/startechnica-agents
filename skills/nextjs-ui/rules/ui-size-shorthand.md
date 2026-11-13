---
title: size-* when width and height match
impact: LOW
tags: tailwind, classes
check: review
---

## `size-*` when width and height match

**Impact: LOW** (two classes where one says it, and they drift apart when one is edited)

**Incorrect:** `<Avatar className="w-10 h-10" />`

**Correct:** `<Avatar className="size-10" />`

**How to check:** search for a `w-N` and `h-N` pair with the same value on one element.
