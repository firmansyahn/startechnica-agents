---
title: Errors don't leak the backend
impact: CRITICAL
tags: proxy
check: review
---

## Errors don't leak the backend

**Impact: CRITICAL**

Backend unreachable or timed out answers 503 in the standard envelope, with no stack trace, backend URL or internal host name. A missing session or refused refresh answers 401 with a cleared session cookie, so the client sends the user to sign in.
