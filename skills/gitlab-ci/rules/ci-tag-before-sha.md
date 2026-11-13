---
title: Don't let a zero BEFORE_SHA rule block tag releases
impact: HIGH
tags: rules, tags, release, templates
check: review
---

## Don't let a zero BEFORE_SHA rule block tag releases

**Impact: HIGH** (a `v*` tag builds nothing and production is never released)

The org templates skip a pipeline whose `CI_COMMIT_BEFORE_SHA` is all zeros, to avoid building when a branch is created. Tag pipelines always have a zero BEFORE_SHA, and rules are first-match-wins, so the template's own rules drop every tag before its `if: $CI_COMMIT_TAG` is reached. Give the build, release and stop jobs their own `rules:` (which replace the template's), letting tags through explicitly.

**Incorrect (the template's rules, kept):**

```yaml
rules:
  - if: '$CI_COMMIT_BEFORE_SHA == "0000000000000000000000000000000000000000" && $CI_PIPELINE_SOURCE != "web" && $CI_PIPELINE_SOURCE != "webide"'
    when: never        # every tag stops here
  - if: $CI_COMMIT_TAG
```

**Correct:**

```yaml
<app>:release:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
      when: never
    - if: '$CI_COMMIT_REF_NAME =~ $APP_REF_INTEG'
      when: never
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH || $CI_COMMIT_TAG || $APP_DEPLOYMENT_TIER != "other"'
      changes: *app-changes   # tags always count as changed
```

Keep the build's, release's and stop job's rules the same (the stop job's last rule `when: manual`), since the release needs the build and the environment needs its stop job.

**How to check:** after a tag push, the tag's pipeline lists `<app>:build` and `<app>:release`.
