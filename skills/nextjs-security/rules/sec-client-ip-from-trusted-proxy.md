---
title: The client IP comes from the trusted proxy only
impact: CRITICAL
tags: requests
check: review
---

## The client IP comes from the trusted proxy only

**Impact: CRITICAL**

Read the address the trusted proxy appends (a configured hop count from the right of `X-Forwarded-For`, or its dedicated header). The left-most `X-Forwarded-For` value is whatever the client sent.
