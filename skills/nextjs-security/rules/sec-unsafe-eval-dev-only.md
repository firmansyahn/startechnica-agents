---
title: 'unsafe-eval' only in development
impact: HIGH
tags: headers
check: review
---

## 'unsafe-eval' only in development

**Impact: HIGH**

React needs `eval` in development for server error stacks; production builds don't. Build the policy from `NODE_ENV` so `'unsafe-eval'` never reaches production.
