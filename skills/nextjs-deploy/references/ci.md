# GitLab CI

Two files, generalised from the team's pipeline: [assets/ci/root.gitlab-ci.yml](../assets/ci/root.gitlab-ci.yml) (the repo root) and [assets/ci/nextjs.gitlab-ci.yml](../assets/ci/nextjs.gitlab-ci.yml) (`<app>/.gitlab-ci.yml`). The org's shared CI templates do the image build and the chart release. Include them by project path and keep their job names.

## Root file: branch → tier

`spec:inputs` sets the chart repository path, the Node major and the runner tags. `workflow:rules` turn the branch into three variables that every job reads: `APP_DEPLOYMENT_TIER`, `APP_CHART_BRANCH` and `APP_ENVIRONMENT_NAME`.

| Branch (variable regex) | Tier | Chart branch |
|---|---|---|
| `main`/`master`/`trunk`, or a `v*` tag (`APP_REF_PRD`) | production | `main` |
| `staging`, `stg`, `stg-*` (`APP_REF_STG`) | staging | `staging` |
| `test`/`testing` (`APP_REF_TEST`) | testing | `testing` |
| `develop`/`dev`/`development` (`APP_REF_DEV`) | development | `develop` |
| `feat/`, `fix/`, `chore/`, ... (`APP_REF_INTEG`) | other | none: no image push, no release |

A branch with an open merge request runs only the merge request pipeline. Per-app image variables (`APP_IMAGE_REPOSITORY`, `APP_REGISTRY_IMAGE`) live in each child file, never in the root. A root value forwards as a pipeline variable and outranks the child's YAML.

Stages: `prepare` → `test` → `build` → `deploy`.

## Web file: jobs

| Job | Stage | Runs | When |
|---|---|---|---|
| `<app>:install` | prepare | `yarn install --immutable`; `<app>/node_modules` and `.yarn/install-state.gz` as a one-day artifact; Yarn cache keyed on `<app>/yarn.lock` | Any change under `<app>/`, the pipeline file or the API document |
| `<app>:typecheck` | test | `yarn gen:api --check` (generated types match the API document), `yarn next typegen`, `yarn typecheck` | Merge requests only (branch pipelines rely on the MR's result) |
| `<app>:lint` | test | `yarn lint` | Merge requests only |
| `<app>:test` | test | `yarn test --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL`, two parallel jobs (`parallel: 2`) | Automatic and blocking on any change under `<app>/` (`ci-tests-block-merge`); the build waits for it |
| `<app>:playwright` | test | `yarn test:e2e` in the Playwright image (same version as `@playwright/test`), report as an artifact | Manual, `allow_failure` until the suite is reliable; then automatic like `<app>:test` |
| `<app>:build` | build | The org's kaniko template: `<app>/shrine/Dockerfile.<tier>` (falls back to `.default`), build args `NODE_VERSION`, `GIT_SHA`, `APP_VERSION`, a kaniko cache repo, tag `<ref-slug>-<short-sha>-<node-major>` plus `<ref-slug>-latest` | Default branch, tags and deploy tiers. A merge request into the production branch builds with `--no-push`, so a broken `next build` is caught before it lands |
| `<app>:release` | deploy | The org's release template: triggers the chart repository's pipeline on `APP_CHART_BRANCH` with the app's chart name, version and image tag, which bumps the chart | After `<app>:build`, same rules, never for `APP_REF_INTEG` branches |
| `<app>:stop-release` | deploy | Stops the GitLab environment | Manual |

Details that matter:

- The checks take `node_modules` from `<app>:install`'s artifact instead of installing again. The install job runs on the same Debian (glibc) base as the Playwright image, so native packages work in both.
- `next build` doesn't type-check a second time (`typescript.ignoreBuildErrors: true` in `next.config.mjs`), because `<app>:typecheck` already ran `tsc`. Run `yarn typecheck` locally.
- A job-level `variables:` block replaces the template's variables instead of merging with them. `<app>:build` and `<app>:release` therefore spell out the template variables they still need: the kaniko image, `APP_CONTAINERFILE_NAME`, `BUILD_OPTS`, and the `UPSTREAM_*` values.
- `<app>:build` overrides the template's `needs: []` to wait for the typecheck (optional, since only merge requests run it).
- Kaniko flags: `--cache=true --cache-repo <image>/cache --cache-ttl 168h --snapshot-mode=redo --compressed-caching=false` (`--compressed-caching=false` trades build time for memory, after an install was OOM-killed), plus retries for push, image download and filesystem extraction.

## Yarn in the jobs: committed release, not Corepack

The template's `.<app>` job runs the committed Yarn release on plain Node (`yarn() { node .yarn/releases/yarn-*.cjs "$@"; }`), as `nextjs-package-manager` requires. A pipeline that still uses Corepack instead (`corepack enable --install-directory ...`, `corepack prepare yarn@<v> --activate`, a `yarn-version` input kept in step with `packageManager`) needs those steps and the input. Both go away with the committed release.

## Package scripts it expects

`lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e` (Playwright), `gen:api` (with `--check`), and `build` (`next build`).
