---
title: Sign-out ends the session on the server too
impact: CRITICAL
tags: session
check: review
---

## Sign-out ends the session on the server too

**Impact: CRITICAL**

Revoke the refresh token at the authorization server, delete the store record and clear the cookie, even when revocation fails. Clearing only the cookie leaves a live session in the store. The order and the optional authorization-server logout are in `oauth-client`.
