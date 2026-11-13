---
title: Run a new pipeline when a stacked MR is retargeted
impact: HIGH
tags: stacked, retarget, pipeline
check: hook, review
---

## Run a new pipeline when a stacked MR is retargeted

**Impact: HIGH** (the MR merges on a pipeline that ran against a different target, or can't be merged at all)

When a base MR merges, GitLab retargets the MRs stacked on it to the base's target. Their pipelines ran against the old target branch, and the MR's `head_pipeline` can come back empty. Start a new MR pipeline, wait for it to pass, then merge. Don't reach for the no-pipeline exception for an MR that has code.

**Incorrect:**

```sh
MERGE_WITHOUT_PIPELINE=1 glab mr merge 43 --yes   # "no pipeline" only because it was retargeted
```

**Correct:**

```sh
glab api projects/:id/merge_requests/43/pipelines -X POST
# wait until head_pipeline.status is success for the MR's sha
glab mr merge 43 --yes --sha <sha>
```

**How to check:** after a stack's base merges, each stacked MR's `head_pipeline` was created after the retarget.
