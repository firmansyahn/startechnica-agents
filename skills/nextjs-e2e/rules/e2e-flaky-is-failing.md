---
title: A flaky test is a failing test
impact: LOW
tags: stability
check: test, scan (candidates), review
---

## A flaky test is a failing test

**Impact: LOW**

A test the CI report marks "flaky" gets an issue and a fix: reproduce with `--repeat-each=20`, read the failing trace. Quarantine with `test.fixme()` plus the issue link only while it's being fixed; don't raise timeouts or retries to hide it.

**How to check:** [assets/tests/e2e-setup.test.ts](../assets/tests/e2e-setup.test.ts) fails when `failOnFlakyTests` is off in CI, and `scripts/scan.sh` reports a config without it. `scripts/scan.sh` also lists `test.fixme(` with no issue link on its line, `test.slow()`, `test.setTimeout(` and `retries` of 3 or more in the specs, their helpers and the config. Whether each flaky test got an issue and a fix stays review.
