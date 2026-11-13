---
title: Public URLs come from configuration, not from Host
impact: HIGH
tags: config
check: review
---

## Public URLs come from configuration, not from Host

**Impact: HIGH**

Redirect URIs, issuer, cookie domain decisions and absolute links come from configured public URLs. `Host` and `X-Forwarded-*` are client-controlled unless the ingress overwrites them; never base a security decision on them.
