---
title: No info line per request
impact: MEDIUM
tags: logging
check: review
---

## No info line per request

**Impact: MEDIUM**

The ingress already logs every request. Successful backend calls are `debug`; 5xx and timeouts `warn`. An `info` per request doubles log volume and hides the lines that matter.
