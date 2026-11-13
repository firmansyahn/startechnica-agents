---
title: Run the related tests while working, the suite before merging
impact: LOW
tags: testing
check: review
---

## Run the related tests while working, the suite before merging

**Impact: LOW**

`yarn vitest related --run <file>` for the files you touch; the whole suite (and the type check) before opening a merge request.
