---
title: Refuse cross-site calls
impact: CRITICAL
tags: proxy
check: test, scan, review
---

## Refuse cross-site calls

**Impact: CRITICAL**

Require a custom header the app's fetch wrapper always sends (`x-<app>-console: 1`), never grant a CORS preflight, and when `Sec-Fetch-Site` is present require `same-origin`. `SameSite=Strict` is a second layer, not the only one.

**How to check:** the proxy test `bff-test-cross-site-403` asks for: no custom header, or `Sec-Fetch-Site: cross-site` or `same-site`, answers 403 with no backend call. `scripts/scan.sh` reports every `Access-Control-Allow-*` header and `OPTIONS` handler in the app, `proxy.ts` and `next.config.*`, since the BFF never grants CORS. Review that the app's fetch wrapper always sends the custom header.
