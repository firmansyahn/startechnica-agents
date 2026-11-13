---
title: Long text truncates with the full value available
impact: LOW
tags: tables, text
check: review
---

## Long text truncates with the full value available

**Impact: LOW** (long values either break the layout or are cut with no way to read them)

`truncate` with a `max-w-*` on the cell content, and the full value in a `title` or tooltip. IDs and hashes can use a middle ellipsis helper.

**How to check:** look for `truncate` cells without a `title` or tooltip, and long-text columns without `truncate` and a `max-w-*`.
