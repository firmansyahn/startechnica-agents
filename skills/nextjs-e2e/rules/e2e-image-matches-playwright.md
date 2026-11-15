---
title: The browser image matches the Playwright version
impact: MEDIUM
tags: scope-and-ci
check: test
---

## The browser image matches the Playwright version

**Impact: MEDIUM**

CI runs in `mcr.microsoft.com/playwright:v<version>-noble` with `<version>` equal to `@playwright/test` in the lockfile (or installs browsers with `yarn playwright install --with-deps chromium`). Bump both in the same change.

**How to check:** [assets/tests/e2e-setup.test.ts](../assets/tests/e2e-setup.test.ts) fails when a `mcr.microsoft.com/playwright:v<version>` image in a CI file isn't the installed `@playwright/test` version. A CI that installs the browsers instead has no image to compare, and an image tag kept in a CI variable is missed.
