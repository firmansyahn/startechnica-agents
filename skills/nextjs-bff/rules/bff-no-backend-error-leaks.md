---
title: Errors don't leak the backend
impact: CRITICAL
tags: proxy
check: test, scan (candidates), review
---

## Errors don't leak the backend

**Impact: CRITICAL**

Backend unreachable or timed out answers 503 in the standard envelope, with no stack trace, backend URL or internal host name. A missing session or refused refresh answers 401 with a cleared session cookie, so the client sends the user to sign in.

**How to check:** a proxy and `apiAction` test with the backend fake refusing connections, then timing out: the reply is 503 in the envelope and its body has no backend URL, host name, `stack` or `at ` frame; with no session it is 401 with a `Set-Cookie` that clears the cookie (`bff-test-signed-out`). `scripts/scan.sh` lists replies built from an error's `message`, `stack` or `cause`, or from `String(err)`, in `src/api/` and `app/`; an error copied into a variable first is missed.
