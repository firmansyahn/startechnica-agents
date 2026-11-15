---
title: Third-party origins are exact, and few
impact: HIGH
tags: headers
check: test, review
---

## Third-party origins are exact, and few

**Impact: HIGH**

Each origin in `connect-src`, `img-src`, `frame-src` is a host the app really calls, written out (`https://errors.example.com`), not `https:` or `*.example.com`. With `'strict-dynamic'`, a nonced third-party script can load anything; add one only if you trust all of its code.

**How to check:** `assets/e2e/security-headers.spec.ts` (copy it to `tests/e2e/`) splits the page's CSP into directives and fails on `*`, a scheme source (`https:`, `http:`, `wss:`) or a wildcard host (`*.example.com`) in `default-src`, `script-src`, `connect-src`, `img-src`, `frame-src`, `media-src`, `font-src` or `worker-src`; `data:` and `blob:` stay allowed for images, media, fonts and workers. Review that each origin is one the app really calls, and any third-party script trusted through `'strict-dynamic'`.
