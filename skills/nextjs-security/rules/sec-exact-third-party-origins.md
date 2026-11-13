---
title: Third-party origins are exact, and few
impact: HIGH
tags: headers
check: review
---

## Third-party origins are exact, and few

**Impact: HIGH**

Each origin in `connect-src`, `img-src`, `frame-src` is a host the app really calls, written out (`https://errors.example.com`), not `https:` or `*.example.com`. With `'strict-dynamic'`, a nonced third-party script can load anything; add one only if you trust all of its code.
