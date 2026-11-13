---
title: 429 carries Retry-After
impact: LOW
tags: rate-limit, 429
check: test
---

## 429 carries Retry-After

**Impact: LOW** (without it clients retry at once and stay limited)

A rate-limited reply says when to try again (`Retry-After: 30`); the frontend shows it and doesn't retry sooner. A query client whose `retry` function skips 4xx (`nextjs-data`) skips 429 too, unless the project retries 429 after the given delay (`retryDelay` read from the error).

**How to check:** a rate-limit test asserts the 429 reply has a `Retry-After` header.
