---
title: Only a buffered body is retried after a refresh
impact: CRITICAL
tags: session
check: review
---

## Only a buffered body is retried after a refresh

**Impact: CRITICAL**

A request whose body was read into memory may be sent again after a refresh; a streamed upload can't be, so it gets no retry and answers the 401.
