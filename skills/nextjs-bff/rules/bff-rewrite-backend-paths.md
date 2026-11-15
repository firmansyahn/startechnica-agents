---
title: proxy.ts rewrites the backend's public paths from the environment
impact: HIGH
tags: config
check: scan (candidates), test, review
---

## proxy.ts rewrites the backend's public paths from the environment

**Impact: HIGH**

The backend's own public paths (`/api/*`, `/oauth2/*`, `/.well-known/*`, ...) are rewritten in `proxy.ts` to the backend URL read per request, so one image serves every environment. On Next 16 the file is `proxy.ts` (Node.js runtime); before that, `middleware.ts`.

**How to check:** `scripts/scan.sh` reports `rewrites` in `next.config.*` (fixed at build, from the build's environment; a rewrite between the app's own pages is a valid hit) and a `middleware.ts` when `package.json` asks for Next 16 or later. A `proxy.ts` unit test sets `BACKEND_URL` inside the test and checks that `proxy()` on `/api/x?y=1` answers a rewrite to `<BACKEND_URL>/api/x?y=1` (`isRewrite` and `getRewrittenUrl` from `next/experimental/testing/server`, or the `x-middleware-rewrite` header). Review the prefix list against the backend's public paths.
