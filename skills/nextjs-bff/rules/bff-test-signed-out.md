---
title: A signed-out request clears the cookie
impact: MEDIUM
tags: testing
check: review
---

## A signed-out request clears the cookie

**Impact: MEDIUM**

No cookie, an unknown session id, or a refused refresh answers 401 with a `Set-Cookie` that clears the session cookie, and no backend call (beyond the refused refresh).
