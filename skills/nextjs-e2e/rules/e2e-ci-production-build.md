---
title: CI tests a production build
impact: MEDIUM
tags: scope-and-ci
check: review
---

## CI tests a production build

**Impact: MEDIUM**

`yarn build && yarn start`: production bundles, the real CSP and headers, no dev overlay, realistic speed. `yarn dev` in CI tests a server that never ships and is slow to compile each page.
