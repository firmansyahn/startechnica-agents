---
title: Run test suites automatically and let them block the merge
impact: HIGH
tags: tests, merge, unattended, rules
check: scan, review
---

## Run test suites automatically and let them block the merge

**Impact: HIGH** (a green pipeline says nothing about the tests, so an unattended merge, a merge guard or a babysitting agent lands untested code)

Test suites run automatically in every MR that touches their app and on the integration branch after the merge, and they block: no `when: manual`, no `allow_failure: true`. Unattended development depends on "green" meaning "the tests passed". When a suite is too slow to block on, make it faster (write the cache once, fold static checks into the test job, split it across parallel jobs, parallel tests inside packages: [../references/fast-tests.md](../references/fast-tests.md)); don't take it out of the gate.

**Incorrect:**

```yaml
# Manual for now: too slow for every MR.
api:test:
  rules:
    - changes: *api-changes
      when: manual
  allow_failure: true
```

**Correct:**

```yaml
api:test:
  parallel:
    matrix:
      - TEST_SHARD: [app, db, rest]
  rules:
    - changes: *api-changes      # automatic, blocking
  script:
    - go test $pkgs               # the shard's packages; the full shape is in references/fast-tests.md
```

A job that is manual on purpose (an end-to-end suite that is broken, a slow benchmark) says so in a comment with the reason and what would make it automatic, and is not what the merge relies on.

**How to check:** the skill's `scripts/scan.sh` lists test jobs with `when: manual` or `allow_failure: true`; in an MR, the pipeline shows the test jobs as automatic and required.
