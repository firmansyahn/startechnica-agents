---
title: Pin job images, pull them through the mirror, and use maintained tools
impact: LOW
tags: images, reproducibility, kaniko
check: scan, review
---

## Pin job images, pull them through the mirror, and use maintained tools

**Impact: LOW** (a pipeline breaks or changes behaviour when an upstream tag moves, hits a registry rate limit, or builds with a tool that no longer gets fixes)

Base images come from the registry mirror variable (`$IMAGE_MIRROR/<image>`), with the language major from an input (`golang:$[[ inputs.golang-version ]]`, `node:$[[ inputs.nodejs-version ]]-trixie-slim`). Tool images are pinned to an exact version: Playwright the same as `@playwright/test`, and kaniko from the maintained fork, `ghcr.io/osscontainertools/kaniko` (`gcr.io/kaniko-project` is archived; the org template still defaults to its floating `:debug`). Use the fork's `-debug` tag: the template's steps need its shell. It keeps the same `/kaniko/executor` layout, so it drops in. The registry is `ghcr.io`, not `gcr.io`.

**Incorrect:**

```yaml
image: node:latest
OCI_BUILDER_IMAGE: gcr.io/kaniko-project/executor:debug
```

**Correct:**

```yaml
image: $IMAGE_MIRROR/node:$[[ inputs.nodejs-version ]]-trixie-slim
OCI_BUILDER_IMAGE: ghcr.io/osscontainertools/kaniko:v1.29.0-debug
```

To upgrade, pick a fork release that has been out for at least two weeks (`gh api repos/osscontainertools/kaniko/releases --jq '.[] | "\(.tag_name) \(.published_at)"'`) and use its `-debug` tag.

**How to check:** grep the CI files for `image:` and `_IMAGE:` values with `:latest`, `:debug` alone, no tag, or `gcr.io/kaniko-project`.
