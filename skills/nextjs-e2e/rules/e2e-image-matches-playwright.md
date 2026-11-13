---
title: The browser image matches the Playwright version
impact: MEDIUM
tags: scope-and-ci
check: review
---

## The browser image matches the Playwright version

**Impact: MEDIUM**

CI runs in `mcr.microsoft.com/playwright:v<version>-noble` with `<version>` equal to `@playwright/test` in the lockfile (or installs browsers with `yarn playwright install --with-deps chromium`). Bump both in the same change.
