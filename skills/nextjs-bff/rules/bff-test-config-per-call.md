---
title: Configuration is read per call
impact: MEDIUM
tags: testing
check: review
---

## Configuration is read per call

**Impact: MEDIUM**

Set an environment variable after importing the module and expect the next call to use it; a module-level read fails this test.
