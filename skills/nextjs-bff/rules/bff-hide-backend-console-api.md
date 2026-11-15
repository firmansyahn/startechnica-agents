---
title: The backend's console API is hidden from the browser
impact: HIGH
tags: config
check: test, review
---

## The backend's console API is hidden from the browser

**Impact: HIGH**

When the backend's console API should be reached only through the BFF, `proxy.ts` answers 404 for it on the public host; the browser calls `/<area>/api/...` instead.

**How to check:** a unit test of `proxy.ts` in the project: a request on the public host for the backend's console prefix answers 404, and the backend fake records no call. Only an app that hides that API has the test. Review that the hidden prefixes are the backend's whole console surface.
