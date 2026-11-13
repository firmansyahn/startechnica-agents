---
title: CI keeps traces and reports
impact: MEDIUM
tags: scope-and-ci
check: review
---

## CI keeps traces and reports

**Impact: MEDIUM**

`trace: "on-first-retry"`, screenshots on failure, the merged HTML report and a junit file as job artifacts (`when: always`). A red e2e job without a trace costs an hour to diagnose.
