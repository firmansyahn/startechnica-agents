---
title: Taint is a seatbelt, not the boundary
impact: HIGH
tags: data
check: review
---

## Taint is a seatbelt, not the boundary

**Impact: HIGH**

`experimental.taint` with `experimental_taintObjectReference`/`experimental_taintUniqueValue` catches a whole record or a secret value crossing to the client, but not copies or derived values. Use it on top of DTOs, never instead of them.
