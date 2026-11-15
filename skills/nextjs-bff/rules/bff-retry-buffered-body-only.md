---
title: Only a buffered body is retried after a refresh
impact: CRITICAL
tags: session
check: test, review
---

## Only a buffered body is retried after a refresh

**Impact: CRITICAL**

A request whose body was read into memory may be sent again after a refresh; a streamed upload can't be, so it gets no retry and answers the 401.

**How to check:** a proxy test: a streamed upload `POST` that the backend fake answers with a guard 401 (`WWW-Authenticate: Bearer`) reaches the fake once, and the client gets the 401; a buffered request in the same situation is refreshed and sent again once.
