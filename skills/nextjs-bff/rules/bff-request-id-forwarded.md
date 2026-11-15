---
title: Request ids are set once and forwarded
impact: HIGH
tags: config
check: test, scan (candidates), review
---

## Request ids are set once and forwarded

**Impact: HIGH**

`proxy.ts` takes `x-request-id` from a trusted ingress (validated: UUID or ≤ 64 safe characters) or makes a UUID, sets it on the request and the reply, and the proxy and `apiAction` forward it to the backend (`nextjs-logging`).

**How to check:** a proxy test: with no incoming id the request and the reply carry a new UUID; an id over 64 characters or with unsafe characters is replaced; the backend fake receives the same `x-request-id` from the reads proxy and from `apiAction`. `scripts/scan.sh` lists modules under `src/api/` that call `fetch(` and never mention `x-request-id`; a call to an authorization server that takes no request id is a valid hit.
