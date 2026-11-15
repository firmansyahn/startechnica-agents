---
title: Forward workflow-set variables to the triggered pipeline
impact: HIGH
tags: trigger, release, variables
check: scan, ci, review
---

## Forward workflow-set variables to the triggered pipeline

**Impact: HIGH** (the chart pipeline runs without the tier, environment or chart branch and bumps the wrong values or nothing)

A trigger job forwards only its YAML variables by default. Variables set by `workflow:rules` (`APP_DEPLOYMENT_TIER`, `APP_CHART_BRANCH`, `APP_ENVIRONMENT_NAME`) are pipeline variables, so the downstream pipeline doesn't get them unless the trigger forwards pipeline variables too.

**Incorrect:**

```yaml
<app>:release:
  trigger:
    project: ${APP_CHART_PROJECT_PATH}
    branch: $APP_CHART_BRANCH
```

**Correct:**

```yaml
<app>:release:
  # The tier variables come from workflow:rules as pipeline variables; the yaml-only forward drops them.
  trigger:
    forward:
      pipeline_variables: true
```

**How to check:** when a CI file's `workflow:rules` set `variables:`, `scripts/scan.sh` reports every job with a `trigger:` and no `pipeline_variables: true`; `scripts/check-merged.sh` (the `ci:rules` job in `assets/ci-rules.gitlab-ci.yml`) does the same over the merged configuration, so a trigger job from a template counts too. A downstream that truly needs none of the variables is a false positive: forward them anyway. In review, the downstream chart pipeline's variables (`glab ci get -R <chart-project> -p <id> --with-variables`) include the tier and the app's image tag.
