---
title: Page gating is a convenience; the backend is the check
impact: HIGH
tags: config
check: review
---

## Page gating is a convenience; the backend is the check

**Impact: HIGH**

A protected page without the session cookie redirects to sign-in from `proxy.ts`. That only saves a round trip; the real check is the backend refusing the token, and the central route → permission map deciding what the signed-in user sees.
