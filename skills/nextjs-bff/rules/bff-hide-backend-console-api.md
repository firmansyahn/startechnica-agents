---
title: The backend's console API is hidden from the browser
impact: HIGH
tags: config
check: review
---

## The backend's console API is hidden from the browser

**Impact: HIGH**

When the backend's console API should be reached only through the BFF, `proxy.ts` answers 404 for it on the public host; the browser calls `/<area>/api/...` instead.
