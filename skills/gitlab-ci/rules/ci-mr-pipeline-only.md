---
title: Run the MR pipeline, not a second branch pipeline
impact: MEDIUM
tags: workflow, merge-request
check: scan, ci, review
---

## Run the MR pipeline, not a second branch pipeline

**Impact: MEDIUM** (every push to an MR branch runs twice; the two can disagree)

With MR pipelines on, a push to a branch with an open MR starts both a branch pipeline and an MR pipeline unless `workflow:rules` drops one. Keep the MR pipeline (it knows the target branch, so `changes` and MR-only checks work) and drop the branch pipeline with `$CI_OPEN_MERGE_REQUESTS`.

**Incorrect:**

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH
```

**Correct:**

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    # A branch with an open merge request gets the merge request's pipeline only.
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never
    - if: $CI_COMMIT_BRANCH =~ $APP_REF_PRD
      variables: { APP_DEPLOYMENT_TIER: production }
    # ... the other tiers
```

**How to check:** when `merge_request_event` appears in the CI files, `scripts/scan.sh` reports a repo where no `workflow:` rule with `$CI_OPEN_MERGE_REQUESTS` has `when: never` (GitLab's `Workflows/MergeRequest-Pipelines.gitlab-ci.yml` include also passes); `scripts/check-merged.sh` checks the merged `workflow:rules` the same way, and also passes a workflow that lets branch pipelines through only for tags and the default branch. A project with MR pipelines turned off that still names the source in a rule is a false positive. In review, push to an MR branch and list the pipelines for its SHA (`glab ci list --sha <sha>`): exactly one, with source `merge_request_event`.
