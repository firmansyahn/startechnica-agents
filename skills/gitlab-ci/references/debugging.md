# Debugging a pipeline

Read the pipeline before changing YAML. Use `glab` (its configured credentials) for everything; `projects/:id` in `glab api` resolves to the current repo's project.

## Find the pipeline

| You have | Command |
|---|---|
| An MR | `glab api projects/:id/merge_requests/<iid> \| jq '.head_pipeline \| {id, status, web_url}'` |
| An MR, all its pipelines | `glab api projects/:id/merge_requests/<iid>/pipelines \| jq '.[] \| {id, status, sha, source}'` |
| A branch (branch pipelines only) | `glab ci status --branch <branch>`, or `glab ci list --ref <branch>` |
| A pipeline id | `glab api projects/:id/pipelines/<id>` |

A branch with an open MR has no branch pipelines (`workflow-and-tiers.md`): look at the MR's.

## Read its jobs and logs

```sh
glab api "projects/:id/pipelines/<id>/jobs?per_page=100" | jq -r '.[] | "\(.id)\t\(.status)\t\(.stage)\t\(.name)\t\(.failure_reason // "")"'
glab api projects/:id/jobs/<job-id>/trace | tail -n 80     # a finished job's log
glab ci trace <job-id>                                      # follow a running job
glab api projects/:id/pipelines/<id>/bridges | jq '.[] | {name, status, downstream_pipeline}'   # trigger jobs and their child pipelines
```

A release job's failure is usually in the downstream chart pipeline: follow `downstream_pipeline.project_id` and `.id`, then read that pipeline's jobs the same way (`projects/<project_id>/pipelines/<id>/jobs`).

## Decide what kind of failure it is

| Signal | Kind | Do |
|---|---|---|
| `failure_reason: runner_system_failure`, `stuck_or_timeout_failure`, `scheduler_failure`; logs with etcd/API timeouts, "pod not found", image pull errors from the runner's cluster | Infrastructure, not the change | Say so, and retry: `glab ci retry <job-id>` |
| `failure_reason: script_failure` | The change (or a flaky test) | Read the trace from the first error, reproduce locally, fix |
| Exit 137 in a build | Out of memory (kaniko) | Lower memory use (`--compressed-caching=false`) or ask for a bigger runner; don't just retry |
| `401`/`403` pulling an image | Registry or mirror access | Check the image path against the mirror variable and the registry host: the kaniko fork is on `ghcr.io/osscontainertools/kaniko`; `gcr.io/osscontainertools/...` doesn't exist and answers 401/403 |
| Status `manual` | A manual job waiting | Start it if it's needed: `glab ci trigger <job-id>` |
| Pipeline `blocked` forever | A manual job without `allow_failure: true` | `ci-manual-allow-failure` |
| Status `skipped` / job absent | Its rules didn't match | Next section |

## A job didn't run

1. **Lint and simulate** with the real branch context:

   ```sh
   glab ci lint
   glab ci lint --dry-run --ref <branch> --include-jobs
   ```

   The dry run evaluates the branch's rules (not MR rules). For MR rules, open the MR and read its pipeline's job list.
2. **Walk the rules top to bottom.** First match wins; a `when: never` above your rule ends it. The template's own rules are replaced, not merged, when the job sets `rules:`.
3. **Check `changes:`.** In an MR it compares with the target branch; a file outside the anchor list doesn't count. Tags always match.
4. **Check the tier.** A `feat/*` branch is tier `other`, where build and release are `never` by design.
5. **Check the BEFORE_SHA rule** for a new branch's first push and for tags (`ci-tag-before-sha`).
6. **Check where a variable comes from.** A root `variables:` value or a workflow-rule variable is a pipeline variable and outranks the child's YAML; `glab ci get -p <id> --with-variables` (Maintainer) shows what the pipeline had.

## Start pipelines by hand

| Need | Command |
|---|---|
| A new MR pipeline (after a retarget, or to re-run everything) | `glab api projects/:id/merge_requests/<iid>/pipelines -X POST` |
| A branch pipeline | `glab ci run --branch <branch>` (add `--variables KEY:value` if needed) |
| Retry one failed job | `glab ci retry <job-id>` |
| Retry all failed jobs in a pipeline | `glab api projects/:id/pipelines/<id>/retry -X POST` |

A pipeline started from the web or the API has `CI_PIPELINE_SOURCE` `web` or `api`; the org templates' zero-BEFORE_SHA rule lets `web` through but not `api`.

## Before pushing a YAML change

- `glab ci lint` on the root file (it resolves `include:` and `spec:inputs`).
- Push to a `feat/` branch with an MR and read the MR pipeline's job list: are the jobs you expect there, and only those?
- A change that affects build or release rules can only be fully seen on the development branch or a tag: watch the first pipeline there and say so in the MR.
