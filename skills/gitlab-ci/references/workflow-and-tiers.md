# Workflow rules and tiers

The root file's `workflow:rules` decide two things for the whole pipeline: whether it runs at all, and which deployment tier it is for. Every job reads the tier from three variables the rules set.

## The rules, in order

GitLab takes the first rule that matches.

```yaml
workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    # A branch with an open merge request gets the merge request's pipeline only.
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never
    - if: "$CI_COMMIT_BRANCH =~ $APP_REF_PRD || $CI_COMMIT_TAG =~ /^v/"
      variables:
        APP_DEPLOYMENT_TIER: "production"
        APP_CHART_BRANCH: "main"
        APP_ENVIRONMENT_NAME: "production"
    # ... staging, testing, other (feature branches), development
```

| Branch (variable regex) | `APP_DEPLOYMENT_TIER` | `APP_CHART_BRANCH` | Image pushed, chart released |
|---|---|---|---|
| `main`/`master`/`trunk`, or a `v*` tag (`APP_REF_PRD`) | production | `main` | yes |
| `staging`, `stg`, `stg-*` (`APP_REF_STG`) | staging | `staging` | yes |
| `uat` (where a project has one) | testing | `uat` | yes |
| `test`/`testing` (`APP_REF_TEST`) | testing | `testing` | yes |
| `feat/`, `fix/`, `chore/`, `add/`, `rc/`, `bugfix/` (`APP_REF_INTEG`) | other | `other` | no |
| `develop`/`dev`/`development` (`APP_REF_DEV`) | development | `develop` | yes |

The regexes are root `variables:` so jobs reuse them in their own rules (`$CI_COMMIT_REF_NAME =~ $APP_REF_INTEG`). `APP_DEPLOYMENT_TIER` defaults to `other` in the root `variables:`.

The tier picks the Dockerfile (`<app>/shrine/Dockerfile.<tier>`, falling back to `Dockerfile.default`) and the chart branch the release triggers.

## MR pipelines vs branch pipelines

| Event | What runs |
|---|---|
| Push to a branch with an open MR | Only the MR pipeline (`merge_request_event`). The branch pipeline is suppressed by the second rule |
| Push to a branch without an MR | A branch pipeline with that branch's tier; for `feat/*` that means checks only, no image |
| Merge into the development branch | A branch pipeline on the development branch: build and release, for the apps that changed |
| A `v*` tag | Production build and release. Tags always count as changed (`rules:changes` is true on tags) |

Consequences:

- **An MR pipeline's ref is `refs/merge-requests/<iid>/head`, not the branch.** `glab ci status --branch <branch>` shows the last *branch* pipeline (often none). Read the MR's pipeline from the MR (`gitlab-mr`).
- **Checks that only run in MRs** (typecheck, lint) use `if: $CI_PIPELINE_SOURCE == "merge_request_event"`. The branch pipeline after the merge relies on the MR's result and only builds.
- **`$CI_OPEN_MERGE_REQUESTS`** is set on branch pipelines when the branch is an MR's source; it is what lets the second rule drop them.
- **An MR whose diff touches no job's `changes:`** gets no pipeline at all (no jobs → no pipeline). A merge guard that requires a green pipeline must allow that case on purpose (`gitlab-mr`).

## spec:inputs

The root file and each child declare `spec: inputs:` above a `---` line, with a `description`, `type` and `default` for each. The root passes its inputs down in `include:`:

```yaml
include:
  - local: <app>/.gitlab-ci.yml
    inputs:
      chart-project-path: $[[ inputs.chart-project-path ]]
      nodejs-version: $[[ inputs.nodejs-version ]]
```

Use inputs for what a project tunes once (chart repository path, language majors, tool versions, runner tags), and `$[[ inputs.x ]]` where they're used. Use `variables:` for what changes per pipeline (tier, image tag). Inputs are interpolated when the YAML is read, so they can name images, job names and include paths; variables can't name job names.

## default:

```yaml
default:
  tags:
    - $[[ inputs.runner-tags ]]
  interruptible: true
```

- `tags` pins every job, the included templates' too, to the team's runners.
- `interruptible: true` lets GitLab cancel an older pipeline's jobs when a newer push to the same ref arrives (with the project's "auto-cancel redundant pipelines" setting on). Release jobs are trigger jobs and aren't cancelled once started.

## Stages

`prepare` (installs shared by later jobs) → `test` → `build` → `deploy`. Jobs with `needs: []` start at once regardless of stage; use that for checks that need nothing (a Go vet/test job), not for the image build (`ci-build-needs-checks`).
