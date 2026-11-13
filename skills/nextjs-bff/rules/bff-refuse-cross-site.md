---
title: Refuse cross-site calls
impact: CRITICAL
tags: proxy
check: review
---

## Refuse cross-site calls

**Impact: CRITICAL**

Require a custom header the app's fetch wrapper always sends (`x-<app>-console: 1`), never grant a CORS preflight, and when `Sec-Fetch-Site` is present require `same-origin`. `SameSite=Strict` is a second layer, not the only one.
