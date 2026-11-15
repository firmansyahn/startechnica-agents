---
name: gitlab-how-to
description: "Use at the start of any GitLab work when it isn't clear which skill applies, or when a task spans several: any glab command, opening, describing, reviewing, checking or merging a merge request, stacked MRs, waiting for a pipeline or nursing a failed one to green, writing or debugging .gitlab-ci.yml, or asking 'what are our rules for GitLab'. Routes to the team overlays (gitlab-mr, gitlab-ci) and GitLab's vendored agent skills they build on (gitlab-glab, gitlab-mr-description, git-mr-adversarial-review, gitlab-pipeline-watch, gitlab-babysit-mr, gitlab-stacked-mrs, gitlab-ci-skill), says when ce-code-review fits, lists the rules they all assume and the hooks that enforce them, and hands branches and commits to git-how-to."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for git repositories hosted on GitLab.
metadata:
  author: firmansyahn
  version: "0.1.2"
---

# GitLab: which skill, and the rules they all assume

**Principle:** Route, don't teach: open the one skill the task needs, and let that skill decide.

This skill only routes: open the skill the task needs, and only that one. Each team skill holds its patterns, its rules (one file per rule, with how each is caught), its own `scripts/scan.sh` and a "Reviewing" section.

The how-to comes from GitLab's own agent skills (gitlab-org/ai/skills), vendored unchanged beside these skills (each has an `UPSTREAM.md` with its source, pinned commit and license). The two **team overlays**, `gitlab-mr` and `gitlab-ci`, add what those skills leave to the project and win where they differ: read the overlay first; it names the upstream skill to follow.

**How to use it:** the skills are installed together, each in its own folder beside this one, wherever the project or user keeps skills; the links below are relative to this file, and a skill named in backticks is the folder of that name beside this one. Open the linked `SKILL.md` with Read (they may not be registered as invocable skills), then only the references and rules it points to.

## Pick the skill

| The task | Team overlay | Upstream skill it builds on | Rules |
|---|---|---|---|
| Any `glab` command; open, update, comment on an MR | [gitlab-mr](../gitlab-mr/SKILL.md) | [gitlab-glab](../gitlab-glab/SKILL.md) | `mr-` |
| Write or refresh an MR description | [gitlab-mr](../gitlab-mr/SKILL.md) section 1 | [gitlab-mr-description](../gitlab-mr-description/SKILL.md) | |
| Review an MR; post the review to it | [gitlab-mr](../gitlab-mr/SKILL.md) section 2 | `ce-code-review` (compound-engineering) for the deep review, [git-mr-adversarial-review](../git-mr-adversarial-review/SKILL.md) for the posted comment | |
| Wait for an MR's pipeline; nurse a failed one to green; merge it | [gitlab-mr](../gitlab-mr/SKILL.md) sections 3-4 | [gitlab-pipeline-watch](../gitlab-pipeline-watch/SKILL.md), [gitlab-babysit-mr](../gitlab-babysit-mr/SKILL.md) | `mr-` |
| Stacked MRs | [gitlab-mr](../gitlab-mr/SKILL.md) | [gitlab-stacked-mrs](../gitlab-stacked-mrs/SKILL.md) | `mr-` |
| Write, change or debug `.gitlab-ci.yml`; a failed or missing job | [gitlab-ci](../gitlab-ci/SKILL.md) | [gitlab-ci-skill](../gitlab-ci-skill/SKILL.md) | `ci-` |
| A Next.js app's image and pipeline; a Go service's | `nextjs-deploy`, [gitlab-ci](../gitlab-ci/SKILL.md) `assets/go.gitlab-ci.yml` | | |
| Branches, worktrees, commits, ignore files, conflicts | `git-how-to` | | |
| Writing or changing a skill or rule; vendoring or updating an upstream skill | `agent-skills-authoring` | | |

From branch to merge:

```
git-how-to          worktree from its base, Conventional Commits
gitlab-mr (§1)      MR targeting the base, visibility checked, description from the diff
gitlab-mr (§2)      ce-code-review, fixes pushed, verified findings posted as one MR comment
gitlab-mr (§3-4)    MR pipeline nursed to green for the MR's sha → glab mr merge <iid> --yes --sha <sha>
git-how-to          worktree and branch removed, other worktrees synced
```

## Rules every skill assumes

1. **The project wins.** Its `AGENTS.md`, `CLAUDE.md`, hooks and project skills override the team skills where they differ. The team overlays override the upstream skills.
2. **GitLab through `glab`**, with its configured credentials; never a pasted token (`mr-glab-for-gitlab`).
3. **The MR targets the branch the work was cut from**, passed explicitly; its title is a Conventional Commit.
4. **Merge only on the MR's own green pipeline**, for its current sha; never auto-merge (`mr-merge-after-green-pipeline`). A stacked MR gets a new pipeline after its base merges (`mr-new-pipeline-after-retarget`).
5. **Green means tested:** the test suites run automatically and block, and are made fast rather than manual (`ci-tests-block-merge`).
6. **Nothing internal leaves in a public repo**: MR title, description, comments, branch name, commit messages (`mr-no-internal-details-public`). Check the visibility before posting anything.
7. **Every platform.** Commands work on Linux, macOS and Windows; where they differ, the skills give each.

## Hooks

Two Claude Code hooks enforce what review otherwise has to catch; when a repo hasn't installed them, say so in a review:

- `guard-mr-merge.mjs` (in `gitlab-mr` `assets/hooks/`): refuses `glab mr merge` unless the MR's head pipeline passed for its current sha.
- `guard-worktree-remove.mjs` (in `git-worktree` `assets/hooks/`): refuses `git worktree remove` while a dependency folder in it is a link.

## Reviewing an MR

Run the "Reviewing" section of `gitlab-mr` (the MR itself, with its scan for public repos and pasted tokens) and of `gitlab-ci` when CI files changed, plus the `git-how-to` skills for the commits and files. Report findings in the format of `agent-skills-authoring`, ordered by impact.
