---
title: No credentialed CORS by reflection
impact: CRITICAL
tags: requests
check: review
---

## No credentialed CORS by reflection

**Impact: CRITICAL**

Never set `Access-Control-Allow-Origin` to the request's `Origin` together with `Access-Control-Allow-Credentials: true`; that lets any site read signed-in replies. Internal endpoints send no CORS headers; a public API lists exact origins or uses no cookies.
