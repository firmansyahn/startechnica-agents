---
title: Request ids are set once and forwarded
impact: HIGH
tags: config
check: review
---

## Request ids are set once and forwarded

**Impact: HIGH**

`proxy.ts` takes `x-request-id` from a trusted ingress (validated: UUID or ≤ 64 safe characters) or makes a UUID, sets it on the request and the reply, and the proxy and `apiAction` forward it to the backend (`nextjs-logging`).
