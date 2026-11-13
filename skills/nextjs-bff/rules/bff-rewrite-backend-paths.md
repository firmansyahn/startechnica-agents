---
title: proxy.ts rewrites the backend's public paths from the environment
impact: HIGH
tags: config
check: review
---

## proxy.ts rewrites the backend's public paths from the environment

**Impact: HIGH**

The backend's own public paths (`/api/*`, `/oauth2/*`, `/.well-known/*`, ...) are rewritten in `proxy.ts` to the backend URL read per request, so one image serves every environment. On Next 16 the file is `proxy.ts` (Node.js runtime); before that, `middleware.ts`.
