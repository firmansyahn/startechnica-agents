---
title: Keep per-app variables in the app's child file
impact: HIGH
tags: monorepo, variables, precedence
check: scan, review
---

## Keep per-app variables in the app's child file

**Impact: HIGH** (every app's image lands in the same repository and overwrites the others)

Root `variables:` (and variables set by `workflow:rules`) are pipeline variables, which outrank the variables a job sets in YAML. A per-app value (`APP_IMAGE_REPOSITORY`, `APP_REGISTRY_IMAGE`, `APP_NAME`) set in the root therefore wins over each child's own value. Set them in each child, on the build and release jobs.

**Incorrect:**

```yaml
# .gitlab-ci.yml (root)
variables:
  APP_REGISTRY_IMAGE: ${CI_REGISTRY_IMAGE}   # web and backend both push here
```

**Correct:**

```yaml
# <app>/.gitlab-ci.yml
.web-app-vars: &web-app-vars
  APP_IMAGE_REPOSITORY: ${CI_PROJECT_PATH}/web
  APP_REGISTRY_IMAGE: ${CI_REGISTRY_IMAGE}/web

web:build:
  variables:
    <<: *web-app-vars
```

**How to check:** `scripts/scan.sh` reports per-app names (`PER_APP_VARS`, default `APP_IMAGE_REPOSITORY|APP_REGISTRY_IMAGE|APP_NAME`) set in the root `.gitlab-ci.yml`'s top-level `variables:` or in its `workflow:rules` variables, when the root includes child files; a single-app repo is skipped. Names the project adds per app go in `PER_APP_VARS`. In review, the root `variables:` hold only values shared by all apps (tier regexes, registry mirror, `APP_IMAGE_TAG_LATEST`), and each build job's log prints its own destination.
