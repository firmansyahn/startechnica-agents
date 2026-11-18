---
name: gitlab-mr
description: "Team overlay on GitLab's agent skills: read it with gitlab-glab (the glab CLI: MRs, notes, pipelines, API), gitlab-mr-description (the description), git-mr-adversarial-review (a review posted to the MR), gitlab-pipeline-watch (waiting for a pipeline), gitlab-babysit-mr (nursing a failed pipeline to green) and gitlab-stacked-mrs (stacks) whenever you open, describe, review, check or merge a merge request, or are asked to ship, land or merge a branch; and for when to use ce-code-review (the deep review) instead. It sets what those skills leave to the project: MRs target the branch the work was cut from (passed explicitly) with Conventional Commits titles, visibility is checked before anything is posted, an MR merges only when its own head pipeline passed for its current sha (never glab's --auto-merge, which merges at once when GitLab sees no running pipeline), MRs without a pipeline, stacked MRs after the base merges, and cleanup via git-worktree. Includes a hook that refuses an unsafe glab mr merge."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for git repositories hosted on GitLab.
metadata:
  author: firmansyahn
  version: "0.2.1"
---

# Merge requests: the team's overlay

**Principle:** A merge request merges only on its own green pipeline, reaches GitLab only through glab, and carries nothing internal into a public project.

The how-to comes from GitLab's own agent skills, vendored unchanged beside this one (updated as `agent-skills-authoring` describes). Follow them; this file only sets what they leave to the project, and wins where it says something different.

| Need | Upstream skill (gitlab-org/ai/skills) |
|---|---|
| Any `glab` command: create or update an MR, notes, reviews, pipelines, jobs, `glab api`, escaping message text | [gitlab-glab](../gitlab-glab/SKILL.md) |
| Write or refresh the MR description from the diff | [gitlab-mr-description](../gitlab-mr-description/SKILL.md) |
| A skeptical review posted to the MR as one comment (High / Medium / Low / Done well) | [git-mr-adversarial-review](../git-mr-adversarial-review/SKILL.md) |
| Wait for an MR's pipeline and react to its result | [gitlab-pipeline-watch](../gitlab-pipeline-watch/SKILL.md) (needs Python 3) |
| Nurse a pipeline to green: classify failures, retry flaky jobs, small fixes, report on the MR | [gitlab-babysit-mr](../gitlab-babysit-mr/SKILL.md) |
| Split work into stacked MRs, re-sync the stack after merges | [gitlab-stacked-mrs](../gitlab-stacked-mrs/SKILL.md) |

One more skill outside this set does the deep review: `ce-code-review` (the compound-engineering plugin; section 2).

Related team skills: `git-worktree` (where the branch lives; cleanup after the merge; conflicts), `git-commit` (commit format), `gitlab-ci` (reading a failed pipeline). All GitLab access goes through `glab` and its configured credentials (`mr-glab-for-gitlab`).

## 1. Open the MR

- **Check the repo's visibility first** (`glab repo view -F json | jq -r .visibility`). If it is public, or you can't tell, the title, description, branch name, commits and notes carry no internal hostnames, IPs, customer, tenant or cluster names, emails or credentials (`mr-no-internal-details-public`).
- **Target the branch the work was cut from** (`--target-branch <base>`, `wt-know-the-base`). Pass it explicitly: glab's default is the project's default branch, which is often `main`, the production branch. Most work branches from the integration branch (`develop`); a stacked MR targets the branch below it (`gitlab-stacked-mrs`); a branch cut from a release or hotfix branch targets that.
- **Title in Conventional Commits** (`feat(<scope>): ...`), like the commits. Upstream's glab says GitLab itself uses capitalised subjects without a type; it also says to follow the repo's own convention, which here is Conventional Commits (`git-commit`).
- **Description: `gitlab-mr-description`**, with these differences:
  - Diff against the MR's target (`git diff origin/<base>...HEAD`), not upstream's `origin/HEAD`, which is often `main`.
  - The project's `.gitlab/merge_request_templates/Default.md` wins when it exists; otherwise upstream's template.
  - Always fill **how it was checked**: the tests and checks run (name them), the pages looked at, and what was *not* checked, including manual CI jobs not run. Upstream omits sections without evidence; this one is never omitted.
  - Reference issues by full URL, as `glab` asks. Write the body to a file first and pass it with `--description "$(cat <file>)"`, by its literal path, so `guard-public-text.mjs` can read it.

## 2. Review before asking for a merge

Two skills, for different jobs:

| | `ce-code-review` (compound-engineering) | `git-mr-adversarial-review` (GitLab) |
|---|---|---|
| Use it for | The deep review of your own change, before the MR or before merging it | A quick skeptical pass on any MR, yours or someone else's, posted to GitLab |
| How | Several reviewer passes with each finding verified; can apply the fixes locally (`--fix`); covers the team's rules through the skills the `<area>-how-to` routers lead to | One pass, one MR comment in a fixed format; never fixes, approves or resolves |
| Output | Findings in the session, fixes in the working tree | One comment on the MR |

The usual order on your own MR: `ce-code-review` first, fix what it confirms, push; then, when reviewers should see the result, post it with `git-mr-adversarial-review`'s format: the verified findings that remain (and deliberate non-fixes) as one comment, so the MR carries the review. Don't post unverified findings, and keep severities honest (upstream: "when in doubt, pick the lower one"). On someone else's MR, `git-mr-adversarial-review` alone is fine. Without the compound-engineering plugin, `git-mr-adversarial-review` is the review.

Both cite team rule IDs where one applies; `git-how-to`, `gitlab-how-to`, `go-how-to` and `nextjs-how-to` lead to the skills that own them.

## 3. Wait for the MR's own pipeline, and nurse it to green

Use `gitlab-pipeline-watch` to wait, `gitlab-babysit-mr` when it fails, or read the MR directly:

```sh
glab api projects/:id/merge_requests/<iid> | jq '{sha, detailed_merge_status, pipeline: .head_pipeline | {id, status, sha}}'
```

- The MR runs an MR pipeline (ref `refs/merge-requests/<iid>/head`); its branch has no branch pipeline while the MR is open (`gitlab-ci`), so `glab ci status --branch` tells you nothing.
- Only a pipeline whose `sha` equals the MR's `sha` counts.
- `failed`: read the failed jobs (`glab` references/ci-pipelines.md, `gitlab-ci` references/debugging.md). A runner or infrastructure failure isn't the change: say so and retry the job. `manual`/`blocked`: a manual job without `allow_failure: true` (`ci-manual-allow-failure`).
- **No pipeline at all** is either one still being created (wait a minute) or an MR that touches only files no job watches (docs, tools, agent files): then it merges without one, and you say so to the user.

**`gitlab-babysit-mr`**, with these differences (it was written for GitLab's own project):

- **"Master broken" means the MR's target is broken.** Check the same job on the target branch's latest pipeline (`glab ci list --ref <base>`); if it fails there too, it isn't this MR. Its `search_known_issues.sh` defaults to `gitlab-org/gitlab` and the "master broken" label: pass our project (`scripts/search_known_issues.sh "<job or test name>" <group>/<project>`) and expect no such label.
- **No Duo Developer.** Skip the `@duo-developer-gitlab-org` delegation; go straight to its local fallback: fix lint in the worktree (`yarn lint --fix`, `gofmt -w`, `go vet`), run the check again, and push a new commit (no amend, no force-push, as upstream says).
- **Runner and infrastructure failures** (`runner_system_failure`, pull or timeout errors) are retried like FLAKY, and named as infrastructure in the report.
- **It stops at green; it never merges.** Merging is section 4, with its checks. Manual jobs with `allow_failure: true` stay ignored, as upstream does.

## 4. Merge only on green

```sh
glab mr merge <iid> --yes --sha <the sha you saw pass>
```

- **Never `--auto-merge` and never a bare `glab mr merge`** (`mr-merge-after-green-pipeline`). Where `gitlab-stacked-mrs` arms auto-merge, merge by hand after each MR's pipeline passed instead. glab's auto-merge only waits when GitLab sees a pipeline running for the MR; otherwise it merges at once, and it has merged MRs whose pipeline was still running and then failed.
- `--sha` makes GitLab refuse if someone pushed after you checked.
- Plain merge commits; no `--squash` or `--rebase` (squash merges also desynchronise stacked children, as `gitlab-stacked-mrs` warns).
- **Stacks:** after a base merges, each MR above it needs a new MR pipeline against its new target before it merges (`mr-new-pipeline-after-retarget`): `glab api projects/:id/merge_requests/<iid>/pipelines -X POST`.
- **Several MRs ready at once** (parallel agents): merge one at a time, in dependency order, each on its own green pipeline; sync only the worktrees that share files with it before the next (`wt-no-merge-loop`). The project's merge method stays "Merge commit": fast-forward and semi-linear need an up-to-date branch, so every merge sends every other MR back for a sync and a new pipeline.

## 5. After the merge

1. Confirm: `glab api projects/:id/merge_requests/<iid> | jq -r '.state, .merge_commit_sha'` gives `merged`.
2. If the merge changed an app, watch the target branch's pipeline: a long-lived branch (`develop`, `main`, staging) builds and releases (`gitlab-ci`).
3. Clean up the worktree and branch, then sync the other open worktrees: `git-worktree` section 3.

## Rules index

One file per rule in `rules/`; the file name is the rule ID. Sections and impact levels: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [mr-merge-after-green-pipeline](rules/mr-merge-after-green-pipeline.md) | Merge only after the MR's own pipeline passed | HIGH | hook (`guard-mr-merge.mjs`) |
| [mr-new-pipeline-after-retarget](rules/mr-new-pipeline-after-retarget.md) | Run a new pipeline when a stacked MR is retargeted | HIGH | hook, review |
| [mr-no-internal-details-public](rules/mr-no-internal-details-public.md) | Keep internal details out of public MRs | CRITICAL | scan (candidates), hook (candidates), review |
| [mr-glab-for-gitlab](rules/mr-glab-for-gitlab.md) | Reach GitLab through glab, never a pasted token | MEDIUM | scan, hook, review |

## Reviewing

1. **Scope:** the MR (its target branch as base) or a branch before it becomes one.
2. **Scan:** `bash <this skill>/scripts/scan.sh <base> [--strict]` from anywhere in the repo. For a public repo (or one you can't confirm is private) add `REPO_PUBLIC=1` and `INTERNAL_PATTERNS='<the project's internal names>'`; with `glab` and `jq` it also reads the current branch's MR (title, description, source branch, notes; `MR=<iid>` picks another). Every line is a candidate: open the rule and confirm it.
3. **Read what the scan can't**, with `glab`: the target branch, what the MR text says in prose about products and network setup, and the head pipeline's status for the MR's current sha. Say whether the repo installed the hooks (`guard-mr-merge.mjs`, `guard-glab-token.mjs`, `guard-public-text.mjs`) or relies on review.
4. **Report** each finding in the team's format (`agent-skills-authoring`), ordered by impact; raise it one level when the repo is public or the MR targets the production branch.

## Enforce it in Claude Code

Three `PreToolUse` hooks for the `Bash` tool (Node; Linux, macOS and Windows):

- [assets/hooks/guard-mr-merge.mjs](assets/hooks/guard-mr-merge.mjs) refuses `glab mr merge` without an MR number, while that MR's head pipeline isn't `success`, or when the passing pipeline is for an older commit than the MR's head. An MR with no pipeline merges only with `MERGE_WITHOUT_PIPELINE=1` in front of the command, written on purpose.
- [assets/hooks/guard-glab-token.mjs](assets/hooks/guard-glab-token.mjs) refuses a command that carries a GitLab token (a `PRIVATE-TOKEN` header, a `glpat-` token, credentials in a URL) or calls the REST API with `curl`/`wget` instead of `glab api` (`mr-glab-for-gitlab`).
- [assets/hooks/guard-public-text.mjs](assets/hooks/guard-public-text.mjs) reads the repo's visibility and, when it is public or unknown, refuses `glab mr create|update|note`, `glab release create`, `gh pr create|edit|comment` and `git push` whose text carries an IPv4 address outside the documentation ranges, a non-noreply email or an `INTERNAL_PATTERNS` match (`mr-no-internal-details-public`). Set `INTERNAL_PATTERNS` in the `env` block of `.claude/settings.local.json` (never committed); `PUBLIC_TEXT_OK=1` in front passes a false positive.

Copy them to `tools/agent-hooks/` and register them in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [
        { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-mr-merge.mjs\"", "timeout": 40 },
        { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-glab-token.mjs\"", "timeout": 10 },
        { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-public-text.mjs\"", "timeout": 40 }
      ] }
    ]
  }
}
```

## Checklist

- [ ] Visibility checked; nothing internal in a public repo's MR
- [ ] Target = the branch the work was cut from, passed explicitly; Conventional Commits title
- [ ] Description from `gitlab-mr-description`, with "how it was checked" filled in
- [ ] Reviewed: `ce-code-review` on your own change, verified findings posted with `git-mr-adversarial-review`'s format when reviewers should see them
- [ ] A failed pipeline nursed with `gitlab-babysit-mr` (no Duo, target-branch check, never merges)
- [ ] `head_pipeline.status == success` for the MR's current `sha`, then `glab mr merge <iid> --yes --sha <sha>`
- [ ] Merge confirmed; the target's pipeline watched if an app changed; worktree cleaned up and others synced (`git-worktree`)
