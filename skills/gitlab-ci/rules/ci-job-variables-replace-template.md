---
title: Restate the template variables a job still needs
impact: HIGH
tags: templates, variables, include
check: review
---

## Restate the template variables a job still needs

**Impact: HIGH** (the build runs with an empty builder image, Dockerfile path or build options)

The org templates set their variables with `variables: !reference [...]` on the job. A job of the same name that sets its own `variables:` replaces that whole block; `extends` and the include don't merge it. So when you add per-app variables to a template job, restate every template variable the job still reads, with a comment saying so.

**Incorrect:**

```yaml
web:build:
  variables:
    APP_REGISTRY_IMAGE: ${CI_REGISTRY_IMAGE}/web   # OCI_BUILDER_IMAGE, APP_CONTAINERFILE_NAME, BUILD_OPTS now unset
```

**Correct:**

```yaml
web:build:
  variables:
    <<: *web-app-vars
    # The template's own variables, which this block replaces.
    OCI_BUILDER_IMAGE: ghcr.io/osscontainertools/kaniko:v1.29.0-debug
    APP_CONTAINERFILE_NAME: <app>/shrine/Dockerfile.${APP_DEPLOYMENT_TIER}
    BUILD_OPTS: >-
      --cache=true --cache-repo ${APP_REGISTRY_IMAGE}/cache --cache-ttl 168h
```

The release job restates `UPSTREAM_PROJECT_ID`, `UPSTREAM_PROJECT_NAME`, `UPSTREAM_ENVIRONMENT_NAME`, `UPSTREAM_ENVIRONMENT_TIER`, `UPSTREAM_COMMIT_TITLE` and `UPSTREAM_PIPELINE_ID` the same way.

**How to check:** read the template (`glab api projects/<org>%2F<ci-templates>/repository/files/<path>/raw?ref=main`) and compare its `variables` block with the job's.
