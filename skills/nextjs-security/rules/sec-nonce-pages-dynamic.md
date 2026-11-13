---
title: Nonce pages render dynamically
impact: HIGH
tags: headers
check: review
---

## Nonce pages render dynamically

**Impact: HIGH**

A statically generated page has no request and no nonce, so its scripts are blocked. Under a nonce policy, pages are dynamic (signed-in pages usually are; others call `await connection()`). If pages must stay static and cached, use SRI instead of nonces.
