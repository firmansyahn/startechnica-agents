---
title: Browser errors are reported once, through one channel
impact: MEDIUM
tags: errors
check: review
---

## Browser errors are reported once, through one channel

**Impact: MEDIUM**

Either an error tracker initialised in `instrumentation-client.ts` (PII scrubbing on, release = build id), or the app's own reporter posting to a route handler. Report from `error.tsx` boundaries, one root `window.onerror`/`unhandledrejection` listener, and unexpected mutation failures (5xx, network), not every refusal. Never `console.log` errors in production code.
