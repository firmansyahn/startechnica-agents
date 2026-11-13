---
title: Gate each app's jobs on that app's changes
impact: MEDIUM
tags: monorepo, rules, changes
check: dry-run, review
---

## Gate each app's jobs on that app's changes

**Impact: MEDIUM** (every MR rebuilds and redeploys every app; or a shared input changes and nothing re-checks)

In a repo with several apps, each app's jobs carry `rules: changes:` with the app's tree, the root pipeline file and any file outside the tree the app reads (an API document its types are generated from). A job that overrides `rules:` repeats the `changes:` anchor in each rule that should depend on it.

**Incorrect:**

```yaml
web:lint:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'   # runs for a backend-only MR too
```

**Correct:**

```yaml
.web-changes: &web-changes
  - <app>/**/*
  - .gitlab-ci.yml
  - <backend>/api/<name>.openapi.json   # the web app's generated types read it

web:lint:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
      changes: *web-changes
```

**How to check:** an MR touching only one app lists only that app's jobs; an MR touching only docs gets no pipeline.
