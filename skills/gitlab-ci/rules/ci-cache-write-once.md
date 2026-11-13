---
title: Let one job on the integration branch write the cache
impact: MEDIUM
tags: cache, speed, parallel
check: review
---

## Let one job on the integration branch write the cache

**Impact: MEDIUM** (every job spends minutes uploading a cache nobody needs; parallel jobs race to overwrite the same key)

A job's cache defaults to `pull-push`: it downloads before the script and uploads after it. For a Go build cache the upload alone can take minutes a job. Test and check jobs only read it (`policy: pull`); one job, on the integration branch, writes it: the one that compiles the most, chosen by a rule-level variable. With `parallel:` jobs, never let every copy write the same key.

**Incorrect:**

```yaml
api:test:
  parallel:
    matrix:
      - TEST_SHARD: [app, db, rest]
  cache:
    key: { files: [api/go.sum] }
    paths: [.cache/go-build]      # every shard, in every MR, uploads after its tests
```

**Correct:**

```yaml
.api:
  variables:
    CACHE_POLICY: pull
  cache:
    key: { files: [api/go.sum] }
    paths: [.cache/go-mod, .cache/go-build]
    policy: $CACHE_POLICY

api:test:
  rules:
    - if: '$CI_COMMIT_BRANCH =~ $APP_REF_DEV && $TEST_SHARD == "app"'
      changes: *api-changes
      variables: { CACHE_POLICY: pull-push }
    - changes: *api-changes
```

**How to check:** in an MR job's trace there is no `Creating cache` / `Uploading cache` section; on the integration branch exactly one job has one.
