---
title: Framework security releases go in within days
impact: MEDIUM
tags: dependencies
check: ci
---

## Framework security releases go in within days

**Impact: MEDIUM**

Next.js and React advisories are applied as soon as the patch release is out, even at moderate severity: they sit on every request. Patch releases are small; don't wait for the next planned upgrade.

**How to check:** `assets/ci/security.gitlab-ci.yml` job `<app>:framework-advisories` runs in the daily scheduled pipeline: `yarn npm audit --all --recursive --environment production --json`, then `assets/ci/framework-advisories.mjs` fails on any advisory for `next`, `@next/*`, `react`, `react-dom` or `react-server-dom-*`, at any severity, and on an audit that didn't run. The merge-request audit (`tool-dependency-audit`) still covers the other packages by severity.
