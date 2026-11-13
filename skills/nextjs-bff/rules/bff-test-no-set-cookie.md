---
title: No reply carries Set-Cookie or a token
impact: MEDIUM
tags: testing
check: review
---

## No reply carries Set-Cookie or a token

**Impact: MEDIUM**

The backend fake answers with `set-cookie`, `www-authenticate` and hop-by-hop headers; the proxy's reply has none of them, and no reply body or header contains the access or refresh token.
