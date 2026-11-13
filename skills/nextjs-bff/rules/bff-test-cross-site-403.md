---
title: Cross-site calls answer 403
impact: MEDIUM
tags: testing
check: review
---

## Cross-site calls answer 403

**Impact: MEDIUM**

A request without the custom header, or with `Sec-Fetch-Site: cross-site` or `same-site`, answers 403 and makes no backend call.
