---
title: Errors say what failed and offer a retry
impact: MEDIUM
tags: states, errors
check: review
---

## Errors say what failed and offer a retry

**Impact: MEDIUM** (users see `[object Object]` or a status code and have no way to try again)

Show the server's message when it has one (`errorText(error)`), otherwise a plain sentence, plus a retry (`refetch`) where retrying can help. Never a raw stack, status code alone or `[object Object]`.

**How to check:** check each error state renders `errorText(error)` or a plain sentence, plus `refetch` where a retry can help.
