---
title: A flaky test is a failing test
impact: LOW
tags: stability
check: review
---

## A flaky test is a failing test

**Impact: LOW**

A test the CI report marks "flaky" gets an issue and a fix: reproduce with `--repeat-each=20`, read the failing trace. Quarantine with `test.fixme()` plus the issue link only while it's being fixed; don't raise timeouts or retries to hide it.
