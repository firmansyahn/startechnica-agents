---
title: Give manual jobs in rules allow_failure: true
impact: MEDIUM
tags: rules, manual, merge
check: review
---

## Give manual jobs in rules allow_failure: true

**Impact: MEDIUM** (the pipeline stays "blocked", never reaches success, and a merge that waits for success never happens)

A job made manual through `rules: when: manual` defaults to `allow_failure: false`, which blocks the pipeline until someone runs it. For optional manual jobs (slow tests, end-to-end runs, an environment stop) set `allow_failure: true`, and say in a comment that they are started from the pipeline page.

**Incorrect:**

```yaml
web:test:
  rules:
    - changes: *web-changes
      when: manual
  script: [yarn test]
```

**Correct:**

```yaml
# Manual for now: start it from the pipeline page. Not blocking while it waits.
web:test:
  rules:
    - changes: *web-changes
      when: manual
  allow_failure: true
  script: [yarn test]
```

Restate it in the job even when an included template sets it, so the job holds whatever the template does.

**How to check:** an MR whose only unrun jobs are manual shows pipeline status `success`, not `blocked` or `manual`.
