---
title: Framing is denied unless a page is meant to be embedded
impact: HIGH
tags: headers
check: test, review
---

## Framing is denied unless a page is meant to be embedded

**Impact: HIGH**

`frame-ancestors 'none'` in the CSP plus `X-Frame-Options: DENY` for old browsers. A page that must be embedded gets its own policy with the exact embedding origins, not a site-wide relaxation.

**How to check:** `assets/e2e/security-headers.spec.ts` (copy it to `tests/e2e/`) fails when the page it loads lacks `frame-ancestors 'none'` in the CSP or `X-Frame-Options: DENY`, and when a page listed in its `EMBEDDABLE` setting doesn't list exactly its embedding origins in `frame-ancestors` or still sends `X-Frame-Options`. It checks the pages it is given: review that the headers' `source` covers every path and that each embeddable page needs to be.
