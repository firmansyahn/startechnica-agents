---
title: Framing is denied unless a page is meant to be embedded
impact: HIGH
tags: headers
check: review
---

## Framing is denied unless a page is meant to be embedded

**Impact: HIGH**

`frame-ancestors 'none'` in the CSP plus `X-Frame-Options: DENY` for old browsers. A page that must be embedded gets its own policy with the exact embedding origins, not a site-wide relaxation.
