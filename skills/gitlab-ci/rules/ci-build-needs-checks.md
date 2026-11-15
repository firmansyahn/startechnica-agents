---
title: Make the image build wait for its checks
impact: MEDIUM
tags: templates, needs, build
check: ci, scan (candidates), review
---

## Make the image build wait for its checks

**Impact: MEDIUM** (an image that fails its typecheck or tests is built, pushed and released anyway)

The org build template sets `needs: []`, so the build starts with the pipeline, beside the tests. Override `needs:` on the build to list the checks it depends on. A check that runs only in MR pipelines is listed with `optional: true`, so branch and tag pipelines (which don't have it) still build.

**Incorrect:**

```yaml
web:build: {}   # inherits needs: [] from the template
```

**Correct:**

```yaml
web:build:
  needs:
    # The typecheck runs only in merge requests; branch and tag pipelines have no such job.
    - job: "web:typecheck"
      optional: true
```

**How to check:** `scripts/check-merged.sh` (run by the `ci:rules` job in `assets/ci-rules.gitlab-ci.yml`) reads the merged configuration, templates included, and reports every build job (`BUILD_JOBS`, default `(^|:)build$`) whose `needs` is `[]`; a deliberate one goes in `NEEDS_EMPTY_OK`, since the merged view drops the comment. `scripts/scan.sh` reads the raw files and lists build jobs with no `needs:` of their own, or `needs: []` without a comment above it; a local build job with no template behind it is a false positive there. Neither checks that the listed `needs` are the right checks: in review, the pipeline graph starts the build after them.
