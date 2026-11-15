---
title: Source maps are uploaded, not served
impact: MEDIUM
tags: errors
check: scan, review
---

## Source maps are uploaded, not served

**Impact: MEDIUM**

Upload source maps to the error tracker at build time and keep them off the public server (`productionBrowserSourceMaps` stays off unless the maps are access-controlled).

**How to check:** `scripts/scan.sh` flags `productionBrowserSourceMaps: true` in `next.config` (a line whose comment names `log-source-maps-not-served` is the access-controlled exception), and, when the scanned folder holds a production build (`.next/BUILD_ID`), any `*.map` under `.next/static`; run it after `next build` in CI to check the output. Review that the maps are uploaded to the error tracker.
