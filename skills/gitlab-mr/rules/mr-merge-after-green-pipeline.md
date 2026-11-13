---
title: Merge only after the MR's own pipeline passed
impact: HIGH
tags: merge, pipeline, glab
check: hook
---

## Merge only after the MR's own pipeline passed

**Impact: HIGH** (untested code lands on the integration branch, and its build and release run from there)

`glab mr merge` defaults to auto-merge, which waits only when GitLab sees a pipeline running for the MR; otherwise it merges at once. It has printed "No pipeline running" and merged while the MR pipeline was in fact running, which then failed. Read `head_pipeline` yourself, merge only on `success` for the MR's current `sha`, and pin that `sha`. An MR that CI gives no pipeline (docs, tools, agent files only) merges only as a stated exception.

**Incorrect:**

```sh
git push && glab mr merge --yes        # no MR number, pipeline not checked
```

**Correct:**

```sh
glab api projects/:id/merge_requests/42 | jq -r '.sha, .head_pipeline.status, .head_pipeline.sha'
# → <sha>, success, <same sha>
glab mr merge 42 --yes --sha <sha>
```

A runner or infrastructure failure isn't the change: say so, retry the job, and wait for `success`; don't merge over it.

**How to check:** the `guard-mr-merge.mjs` hook refuses the merge; in review, the MR page shows a passed pipeline for the merged commit.
