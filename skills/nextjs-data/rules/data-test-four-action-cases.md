---
title: Every action has four tests
impact: MEDIUM
tags: testing
check: review
---

## Every action has four tests

**Impact: MEDIUM**

In a Vitest `node` test, with `fetch` stubbed and `next/headers` mocked for the cookie: invalid input (no backend call, field errors in the `Result`), signed out, backend refusal (status and message passed through), success (the call made and the row returned).
