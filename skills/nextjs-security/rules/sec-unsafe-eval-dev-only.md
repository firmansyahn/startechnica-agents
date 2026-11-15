---
title: 'unsafe-eval' only in development
impact: HIGH
tags: headers
check: test
---

## 'unsafe-eval' only in development

**Impact: HIGH**

React needs `eval` in development for server error stacks; production builds don't. Build the policy from `NODE_ENV` so `'unsafe-eval'` never reaches production.

**How to check:** `assets/e2e/security-headers.spec.ts` (the end-to-end test of `sec-csp-nonce`) loads a page of the production build and fails when `script-src` has `'unsafe-eval'`; that assertion runs only on the production build (`CI` or `E2E_PROD=1`), since `next dev` needs `'unsafe-eval'`.
