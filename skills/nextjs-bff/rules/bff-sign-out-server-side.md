---
title: Sign-out ends the session on the server too
impact: CRITICAL
tags: session
check: test, review
---

## Sign-out ends the session on the server too

**Impact: CRITICAL**

Revoke the refresh token at the authorization server, delete the store record and clear the cookie, even when revocation fails. Clearing only the cookie leaves a live session in the store. The order and the optional authorization-server logout are in `oauth-client`.

**How to check:** a sign-out test with the revocation endpoint fake answering 500, and again unreachable: revocation was attempted, the store record is gone, and the reply's `Set-Cookie` clears the session cookie. The order of the steps and the authorization server's logout are reviewed against `oauth-client`.
