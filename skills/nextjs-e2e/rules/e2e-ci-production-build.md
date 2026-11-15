---
title: CI tests a production build
impact: MEDIUM
tags: scope-and-ci
check: test, review
---

## CI tests a production build

**Impact: MEDIUM**

`yarn build && yarn start`: production bundles, the real CSP and headers, no dev overlay, realistic speed. `yarn dev` in CI tests a server that never ships and is slow to compile each page.

**How to check:** [assets/tests/e2e-setup.test.ts](../assets/tests/e2e-setup.test.ts) loads `playwright.config.ts` with `CI=1` and fails when the app's web server command doesn't `start` a build or runs `dev`, and when a CI file (`.gitlab-ci.yml`, `.gitlab/ci/`, `.github/workflows/`, in the app and the repository root) runs `yarn dev` or `next dev`. A dev server started by a script the CI file calls is missed.
