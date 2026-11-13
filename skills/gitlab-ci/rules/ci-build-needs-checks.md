---
title: Make the image build wait for its checks
impact: MEDIUM
tags: templates, needs, build
check: review
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

**How to check:** in the pipeline graph the build starts after its checks; a deliberate `needs: []` (checks still manual) has a comment saying so.
