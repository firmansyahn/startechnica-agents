---
title: Source maps are uploaded, not served
impact: MEDIUM
tags: errors
check: review
---

## Source maps are uploaded, not served

**Impact: MEDIUM**

Upload source maps to the error tracker at build time and keep them off the public server (`productionBrowserSourceMaps` stays off unless the maps are access-controlled).
