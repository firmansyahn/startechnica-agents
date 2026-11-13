---
title: A guard 401 refreshes once; a handler 401 passes through
impact: MEDIUM
tags: testing
check: review
---

## A guard 401 refreshes once; a handler 401 passes through

**Impact: MEDIUM**

A 401 with `WWW-Authenticate: Bearer` triggers one refresh and one retry; a second 401 ends the session. A 401 without that header reaches the client unchanged, with no refresh.
