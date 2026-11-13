# Monorepo files and the org templates

## One child file per app

A repo with several deployable apps (a Go backend and a Next.js web app, say) keeps one root file and one `<app>/.gitlab-ci.yml` per app. The root holds the workflow, the shared regexes and `stages:`; each child holds its app's jobs, caches and per-app variables, and includes the org templates under its own job names.

Job names carry the app as a prefix (`api:test`, `web:build`), so two apps' jobs never collide in one pipeline.

### rules:changes per app

```yaml
.web-changes: &web-changes
  - <app>/**/*
  - .gitlab-ci.yml
  # The API document the web app's types are generated from.
  - <backend>/api/<name>.openapi.json

.web:
  rules:
    - changes: *web-changes
```

- List the app's own tree, the root pipeline file (its tier variables and inputs feed every job) and any file outside the tree the app reads at build or check time.
- In an MR pipeline, `changes` compares with the target branch; on a branch pipeline, with the previous push. Tags always count as changed.
- A job that overrides `rules:` loses the anchor's; repeat `changes: *web-changes` in every rule that should still depend on it.

### Install once, share by artifact

A Node app installs in `prepare` and passes `node_modules` to the checks as an artifact (one day), instead of every check installing again:

```yaml
web:install:
  stage: prepare
  cache: { key: { files: [<app>/yarn.lock] }, paths: [.cache/yarn] }
  script: [yarn install --immutable]
  artifacts:
    paths: [<app>/node_modules/, <app>/.yarn/install-state.gz]   # yarn run refuses to start without its install state
    expire_in: 1 day

.web-check:
  needs: ["web:install"]
```

Build the install on the same libc as every image that reuses it (Debian slim for Node and the Playwright image), or native packages break.

A Go app caches the module and build caches inside the project dir, keyed on `go.sum` (`GOMODCACHE: $CI_PROJECT_DIR/.cache/go-mod`, `GOCACHE: $CI_PROJECT_DIR/.cache/go-build`), since the cache can only hold paths under the project.

### Database tests

Jobs run as root, where a test helper that runs `initdb` itself refuses to start. Give the tests a PostgreSQL service instead and point them at it with a DSN variable:

```yaml
services:
  - name: $IMAGE_MIRROR/postgres:16-alpine
    alias: postgres
    # A throwaway server needn't be durable; parallel test packages need connections.
    command: ["postgres", "-c", "max_connections=500", "-c", "fsync=off", "-c", "full_page_writes=off"]
variables:
  POSTGRES_PASSWORD: <ci-only-password>
  <APP>_TEST_DSN: postgres://postgres:<ci-only-password>@postgres:5432/postgres?sslmode=disable
```

The official image carries the contrib extensions (`citext`, `pg_trgm`) migrations commonly create.

## The org templates

The org keeps shared templates in a CI-templates project (`<org>/<ci-templates>`, ref `main`, under `ci/templates/`): `Jobs/Image-Build-Push.gitlab-ci.yml` (kaniko), `Jobs/Image-Release.gitlab-ci.yml` (trigger the chart repository), and per-language collections. Read a template before overriding it; don't guess:

```sh
glab api "projects/<org>%2F<ci-templates>/repository/files/ci%2Ftemplates%2FJobs%2FImage-Build-Push.gitlab-ci.yml/raw?ref=main"
glab api "projects/<org>%2F<ci-templates>/repository/tree?path=ci/templates&recursive=true&per_page=100" | jq -r '.[].path'
```

Include them under the app's own job names:

```yaml
include:
  - project: <org>/<ci-templates>
    ref: main
    file: ci/templates/Jobs/Image-Build-Push.gitlab-ci.yml
    inputs: { job-name: <app>:build, job-stage: build, containerfile-dir: <app>/shrine }
  - project: <org>/<ci-templates>
    ref: main
    file: ci/templates/Jobs/Image-Release.gitlab-ci.yml
    inputs: { job-name: web:release, job-stop-name: web:stop-release, job-stage: deploy }
```

### What the build template does

- Image `$OCI_BUILDER_IMAGE` (kaniko `:debug`, which has a shell), `needs: []`.
- Dockerfile `<containerfile-dir>/Dockerfile.${APP_DEPLOYMENT_TIER}`, falling back to `Dockerfile.default`.
- Pushes `${APP_REGISTRY_IMAGE}:${APP_IMAGE_TAG}` and `:${APP_IMAGE_TAG_LATEST}`, with OCI labels, then `$BUILD_OPTS`.
- Optional `.env`/`config.json` from variables (`APP_ENCODED_ENV_VAR`, `APP_ENV_FILE`, ...); the team's apps don't use them (settings come from Kubernetes at runtime).
- Its rules: never in an MR; never when `CI_COMMIT_BEFORE_SHA` is all zeros (a new branch, and every tag) unless started from the web; manual on `APP_REF_INTEG` branches.

### What the release template does

- A trigger job: `trigger: project: ${APP_CHART_PROJECT_PATH}`, `branch: $APP_CHART_BRANCH`, `strategy: depend` (the job's status is the chart pipeline's).
- `environment: name: $APP_ENVIRONMENT_NAME`, `on_stop:` the stop job (manual, `action: stop`).
- `UPSTREAM_*` variables (project, environment, commit title, pipeline id) the chart pipeline reads to bump the app's image tag.
- `needs: [image-build-push]` by the template's default job name; an app that renames the build job sets `needs: ["<app>:build"]` itself.

### The overrides every app makes

| Override | Why | Rule |
|---|---|---|
| `variables:` with the per-app values **and** the template's own (`OCI_BUILDER_IMAGE`, `APP_CONTAINERFILE_NAME`, `BUILD_OPTS`; `UPSTREAM_*` on the release) | A job's `variables:` replaces the template's block | `ci-job-variables-replace-template` |
| `needs:` on the build | The template's `needs: []` builds beside the tests | `ci-build-needs-checks` |
| `rules:` on build, release and stop | Add `changes:`, refuse MRs and `APP_REF_INTEG`, and let tags through | `ci-tag-before-sha` |
| `trigger: forward: pipeline_variables: true` on the release | The tier variables come from `workflow:rules` | `ci-forward-pipeline-variables` |
| `environment:` on the release with the renamed stop job | `on_stop` must name the job as included | — |
| A pinned kaniko image from the maintained fork (`ghcr.io/osscontainertools/kaniko:v<x.y.z>-debug`) | The template defaults to the archived `gcr.io/kaniko-project/executor:debug`, which floats and gets no fixes | `ci-pin-images` |

Kaniko flags the team uses: `--cache=true --cache-repo ${APP_REGISTRY_IMAGE}/cache --cache-ttl 168h --use-new-run`, `--build-arg GIT_SHA=${CI_COMMIT_SHORT_SHA} --build-arg APP_VERSION=${CI_COMMIT_REF_NAME}`, and for a Node build `--snapshot-mode=redo --compressed-caching=false` (memory: a first build was OOM-killed, exit 137) plus `--push-retry=3 --image-download-retry=3 --image-fs-extract-retry=3`. An MR into the production branch can run the build with `--no-push` (a rule-level variable), so a broken build is caught before it lands.

### Image tags

`APP_IMAGE_TAG: ${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}` (a Node app appends its Node major), and `APP_IMAGE_TAG_LATEST: ${CI_COMMIT_REF_SLUG}-latest` from the root. `APP_IMAGE_REPOSITORY` and `APP_REGISTRY_IMAGE` are `${CI_PROJECT_PATH}/<app>` and `${CI_REGISTRY_IMAGE}/<app>`, set in the child (`ci-per-app-vars-in-child`).
