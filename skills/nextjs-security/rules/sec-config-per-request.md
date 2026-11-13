---
title: Runtime config is read per request
impact: HIGH
tags: data
check: review
---

## Runtime config is read per request

**Impact: HIGH**

Server config is read when a request needs it (`config()` in `src/api/config.ts`), not at module load and not in `next.config`, so one image runs in every environment and rotated secrets take effect without a rebuild. Public runtime config reaches the browser as a server-rendered prop, not `NEXT_PUBLIC_`.
