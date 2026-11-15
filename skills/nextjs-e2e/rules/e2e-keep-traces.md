---
title: CI keeps traces and reports
impact: MEDIUM
tags: scope-and-ci
check: test, review
---

## CI keeps traces and reports

**Impact: MEDIUM**

`trace: "on-first-retry"`, screenshots on failure, the merged HTML report and a junit file as job artifacts (`when: always`). A red e2e job without a trace costs an hour to diagnose.

**How to check:** [assets/tests/e2e-setup.test.ts](../assets/tests/e2e-setup.test.ts) fails when `use.trace` (top level or a project's) keeps no trace on failure, `use.screenshot` isn't `only-on-failure`, an on-retry trace has no retries in CI, a CI file with the e2e job lacks `when: always`, `playwright-report` or `reports: junit:`, or CI writes blob reports that no CI file merges. The CI checks read whole files, not jobs, so a `when: always` on another job counts; review the job itself.
