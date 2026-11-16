---
name: gitlab-ci
description: "Team overlay on GitLab's gitlab-ci-skill: read it with that skill when writing, changing, reviewing or debugging a GitLab CI/CD pipeline (.gitlab-ci.yml and its includes). It holds what the generic skill can't know: workflow rules that map the branch to a deployment tier and run merge-request pipelines instead of duplicate branch pipelines, spec:inputs, a monorepo root that includes one child file per app with rules:changes, the org's shared CI templates (kaniko build, chart release) and their traps (job variables replace the template's, needs: [], tag pipelines and the zero BEFORE_SHA rule, trigger forwarding), test suites that run automatically and block the merge, made fast (cache written once, sharding, nightly runs that never deploy), manual optional jobs, caches and artifacts. Also when a pipeline or job failed, didn't start or ran the wrong jobs: reading pipelines and traces with glab, linting the YAML, retrying a runner failure, starting a manual job."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for git repositories hosted on GitLab.
metadata:
  author: firmansyahn
  version: "0.2.2"
---

# GitLab CI: the team's overlay

**Principle:** A pipeline runs what the change needs, blocks the merge on its checks, and builds the image only after the checks pass.

**Start from the team-adapted [gitlab-ci-skill](../gitlab-ci-skill/SKILL.md)** for CI syntax, the mental model, caching, images, optimising, debugging a failed job, and verifying YAML (`glci lint`, `scripts/verify.sh`). Its upstream source is recorded in that skill's `UPSTREAM.md`. This file adds the team's pipeline shape, the org's shared templates and their traps, and wins where it says something different (for example, the team includes the org templates rather than CI/CD Catalog components).

The team's pipelines share one shape: a root `.gitlab-ci.yml` decides the deployment tier from the branch, includes one child file per app, and each app tests itself, builds its image with the org's kaniko template and releases it by triggering the Helm chart repository on the tier's branch. Pipelines run for merge requests and for the long-lived branches, never twice for one push.

```
push / MR ─► root .gitlab-ci.yml
             workflow:rules   MR event → MR pipeline; branch with open MR → none; branch → tier variables
             include: local   <app>/.gitlab-ci.yml (inputs passed down), one per app
                 └─ <app>:install/test/lint ─ <app>:build (org kaniko template) ─ <app>:release (trigger chart repo)
stages: prepare → test → build → deploy
```

Related: `gitlab-mr` (opening, checking and merging merge requests; waiting for the pipeline), `nextjs-deploy` (the Next.js app's jobs, Dockerfile and its `assets/ci/` root and web files), `git-commit` (`[ci skip]`). All GitLab access goes through `glab` and its configured credentials, never plain `curl` or `git` over HTTPS with a token pasted in.

## Read the reference for the task

| Task | Reference |
|---|---|
| `workflow:rules`, the branch → tier table, MR vs branch pipelines, `spec:inputs`, `default:` | [references/workflow-and-tiers.md](references/workflow-and-tiers.md) |
| A monorepo root with child files, `rules:changes`, the org templates and what to override, caches and artifacts | [references/monorepo-and-templates.md](references/monorepo-and-templates.md) |
| Tests too slow to block on: measuring where the time goes, then cache, folded checks, sharding, parallel tests; post-merge and nightly runs | [references/fast-tests.md](references/fast-tests.md) |
| A pipeline failed, didn't start or ran the wrong jobs: the team-specific causes (MR vs branch pipelines, tiers, the org templates' rules), retrying, manual jobs. General job debugging is in `gitlab-ci-skill` | [references/debugging.md](references/debugging.md) |

## Files to copy

| Asset | Put it at |
|---|---|
| `nextjs-deploy` [assets/ci/root.gitlab-ci.yml](../nextjs-deploy/assets/ci/root.gitlab-ci.yml) | `.gitlab-ci.yml` (the root: tiers and includes) |
| `nextjs-deploy` [assets/ci/nextjs.gitlab-ci.yml](../nextjs-deploy/assets/ci/nextjs.gitlab-ci.yml) | `<app>/.gitlab-ci.yml` (a Next.js app) |
| [assets/go.gitlab-ci.yml](assets/go.gitlab-ci.yml) | `<go-app>/.gitlab-ci.yml` (a Go service: module/vulnerability checks, lint, vet, tests against a PostgreSQL service, kaniko build, chart release) |
| [assets/ci-rules.gitlab-ci.yml](assets/ci-rules.gitlab-ci.yml) and [scripts/check-merged.sh](scripts/check-merged.sh) | `ci/ci-rules.gitlab-ci.yml` (included from the root) and `tools/ci/check-merged.sh`: a job that checks the merged configuration, templates included, in MRs that change CI files and nightly. It needs a read-only token in `CI_RULES_TOKEN` (the file's header says how) |

Fill in `<org>`, `<app>`, the chart path and the runner tag. Add the child to the root's `include:` with its inputs.

## Rules

1. **One pipeline per change.** MR events get the MR pipeline; a branch push with an open MR gets none; other branches get a tier from `workflow:rules`. → `ci-mr-pipeline-only`
2. **Each app's jobs run only when that app changed**: `rules: changes:` lists the app's tree, the root pipeline file and any shared input it reads (an API document). → `ci-changes-per-app`
3. **Per-app values live in the child file**, never in the root `variables:`. A root value is forwarded as a pipeline variable and outranks the child's YAML. → `ci-per-app-vars-in-child`
4. **A job's `variables:` replaces the template's**, it doesn't merge. A job that sets any variable spells out every template variable it still needs. → `ci-job-variables-replace-template`
5. **Override the template's `needs: []`** on the build so it waits for the checks it depends on (`optional: true` for jobs that only run in MRs). → `ci-build-needs-checks`
6. **Test suites run automatically and block the merge**, in MRs and again on the integration branch; unattended merges rely on green meaning tested. When they're slow, make them fast ([references/fast-tests.md](references/fast-tests.md)), never manual. → `ci-tests-block-merge`
7. **One job on the integration branch writes the cache**; every other job only reads it (`policy: pull`). → `ci-cache-write-once`
8. **A manual job in `rules` gets `allow_failure: true`**, or the pipeline sits in "blocked" and never reaches `success`. Manual is for optional jobs only, never the tests the merge relies on. → `ci-manual-allow-failure`
9. **Tag pipelines always have a zero `CI_COMMIT_BEFORE_SHA`**: a release job whose rules refuse that SHA never runs on a tag. Write the release and stop jobs' rules yourself. → `ci-tag-before-sha`
10. **A trigger job that passes workflow-set variables downstream** sets `trigger: forward: pipeline_variables: true`. → `ci-forward-pipeline-variables`
11. **Images are pinned** (major for language images, exact for tools) and pulled from the registry mirror variable. Kaniko is the maintained fork, `ghcr.io/osscontainertools/kaniko:<version>-debug`, never the archived `gcr.io/kaniko-project`. → `ci-pin-images`
12. **Comment why**, next to every override of a template and every non-obvious rule: the next person can't see the template from the file.

## Rules index

One file per rule in `rules/`; the file name is the rule ID. Sections and impact levels: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ci-mr-pipeline-only](rules/ci-mr-pipeline-only.md) | Run the MR pipeline, not a second branch pipeline | MEDIUM | scan, ci, review |
| [ci-changes-per-app](rules/ci-changes-per-app.md) | Gate each app's jobs on that app's changes | MEDIUM | dry-run, review |
| [ci-per-app-vars-in-child](rules/ci-per-app-vars-in-child.md) | Keep per-app variables in the app's child file | HIGH | scan, review |
| [ci-job-variables-replace-template](rules/ci-job-variables-replace-template.md) | Restate the template variables a job still needs | HIGH | review |
| [ci-tests-block-merge](rules/ci-tests-block-merge.md) | Run test suites automatically and let them block the merge | HIGH | scan (test jobs with `when: manual` or `allow_failure: true`), review |
| [ci-cache-write-once](rules/ci-cache-write-once.md) | Let one job on the integration branch write the cache | MEDIUM | ci, scan (candidates), review |
| [ci-build-needs-checks](rules/ci-build-needs-checks.md) | Make the image build wait for its checks | MEDIUM | ci, scan (candidates), review |
| [ci-manual-allow-failure](rules/ci-manual-allow-failure.md) | Give manual jobs in rules allow_failure: true | MEDIUM | scan, ci, review |
| [ci-tag-before-sha](rules/ci-tag-before-sha.md) | Don't let a zero BEFORE_SHA rule block tag releases | HIGH | ci, review |
| [ci-forward-pipeline-variables](rules/ci-forward-pipeline-variables.md) | Forward workflow-set variables to the triggered pipeline | HIGH | scan, ci, review |
| [ci-pin-images](rules/ci-pin-images.md) | Pin job images, pull them through the mirror, and use maintained tools | LOW | scan (`:latest`, bare `:debug`, untagged, `gcr.io/kaniko-project`), review |

## Reviewing

1. **Scope:** the changed CI files, or every `.gitlab-ci.yml` in the repo.
2. **Lint:** `glab ci lint`; for changed rules, `glab ci lint --dry-run --ref <branch> --include-jobs` and compare the job list with what you expect.
3. **Scan:** `bash <this skill>/scripts/scan.sh [--strict]` from anywhere in the repo reads the raw files. Then `bash <this skill>/scripts/check-merged.sh --ref <pushed branch or sha>` (needs `glab`, `jq` and mikefarah's `yq` v4) checks the merged configuration, where the org templates' `needs`, `rules`, `cache` and `allow_failure` are visible; pass a saved `merged.yml` instead of `--ref` to check one offline. Every line is a candidate: open the rule and confirm it.
4. **Read what the scan can't:** the rules checked only in review, against each changed job.
5. **Report** each finding in the team's format (`agent-skills-authoring`), ordered by impact; raise it one level when the job builds or releases to production.

## Checklist

- [ ] `glab ci lint` passes; for rule changes, `glab ci lint --dry-run --ref <branch> --include-jobs` lists the jobs you expect
- [ ] An MR touching only app A runs only app A's jobs; an MR touching only docs runs none
- [ ] A push to the development branch builds and releases; a `feat/` branch with no MR builds nothing
- [ ] Every template override has a comment saying what the template does and why it's overridden
- [ ] Test jobs are automatic and blocking (no `when: manual`, no `allow_failure`); only one job on the integration branch writes the cache
- [ ] Manual jobs (optional ones only) have `allow_failure: true`; the build's `needs` lists the checks it waits for
