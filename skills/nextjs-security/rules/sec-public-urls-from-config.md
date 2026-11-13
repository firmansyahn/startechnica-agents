---
title: Public URLs come from configuration, not Host
impact: CRITICAL
tags: requests
check: review
---

## Public URLs come from configuration, not Host

**Impact: CRITICAL**

Absolute links (emails, OAuth redirect URIs, absolute redirects) are built from the configured public URL. `Host` and `X-Forwarded-Host` are client-controlled unless the proxy overwrites them.
