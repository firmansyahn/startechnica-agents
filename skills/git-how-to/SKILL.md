---
name: git-how-to
description: "Use at the start of any git work when it isn't clear which skill applies, or when a task spans several: starting branch work in an isolated worktree, setting the base, dependencies in a worktree, committing (Conventional Commits, staging by name, line endings, [ci skip], author identity), what to ignore and where, merge conflicts and generated files, finishing a branch and cleaning up after the merge, or asking 'what are our rules for git'. Routes to the team skills (git-worktree, git-commit, git-gitignore, git-using-worktrees, finishing-a-development-branch, git-resolve-conflicts), lists the rules they all assume, and hands merge requests and pipelines to gitlab-how-to."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for any git repository.
metadata:
  author: firmansyahn
  version: "0.1.3"
---

# Git: which skill, and the rules they all assume

**Principle:** Route, don't teach: open the one skill the task needs, and let that skill decide.

This skill only routes: open the skill the task needs, and only that one. Each team skill holds its patterns, its rules (one file per rule, with how each is caught), its own `scripts/scan.sh` and a "Reviewing" section.

The workflow includes team-maintained skills adapted from established public sources, plus vendored references that remain unchanged (each source has an `UPSTREAM.md` with its source, pinned commit and license). The **team overlays** set project conventions and win where upstream material differs: read the overlay first.

**How to use it:** the skills are installed together, each in its own folder beside this one, wherever the project or user keeps skills; the links below are relative to this file, and a skill named in backticks is the folder of that name beside this one. Open the linked `SKILL.md` with Read (they may not be registered as invocable skills), then only the references and rules it points to.

## Pick the skill

| The task | Team skill or reference | Source or related skill | Rules |
|---|---|---|---|
| Start branch work in isolation; set the base; dependencies in a worktree | [git-worktree](../git-worktree/SKILL.md) | [git-using-worktrees](../git-using-worktrees/SKILL.md) (team workflow adapted from obra/superpowers) | `wt-` |
| Finish a branch; clean up after the merge; sync the other worktrees | [git-worktree](../git-worktree/SKILL.md) | [finishing-a-development-branch](../finishing-a-development-branch/SKILL.md) (team workflow adapted from obra/superpowers) | `wt-` |
| Merge conflicts, generated files in a conflict | [git-resolve-conflicts](../git-resolve-conflicts/SKILL.md), then [git-worktree](../git-worktree/SKILL.md) section 4 | Team workflow adapted from tailcallhq/forgecode | |
| A commit message, what to stage, line endings, `[ci skip]`, author identity | [git-commit](../git-commit/SKILL.md) | The Conventional Commits 1.0.0 spec | `commit-` |
| What to ignore and where, a `.gitignore` change, a committed file that should be ignored, `.dockerignore` in step | [git-gitignore](../git-gitignore/SKILL.md) | gitignore(5), GitHub's github/gitignore templates | `ignore-` |
| Merge requests, reviews posted to them, pipelines, merging | `gitlab-how-to` | | |
| Go or Next.js code | `go-how-to`, `nextjs-how-to` | | |
| Writing or changing a skill or rule; vendoring or updating an upstream skill; the skills lint | `agent-skills-authoring` | | |

The whole path of one change, in order:

```
git-worktree (§1-2)  .worktrees/<topic> from its base, own dependencies
git-commit           Conventional Commits, staged by name, LF
gitlab-how-to        MR targeting the base, reviewed, pipeline green for its sha, merged
git-worktree (§3)    processes stopped, links checked, worktree and branch removed, other worktrees synced
git-worktree (§4)    conflicts on the way: merge from the base, git-resolve-conflicts, regenerate generated files
```

## Rules every skill assumes

1. **The project wins.** Its `AGENTS.md`, `CLAUDE.md`, hooks and project skills override the team skills where they differ. The team overlays override the upstream skills.
2. **Branch work in its own worktree** when the checkout isn't yours alone, with its own dependencies: its own `node_modules` and Go modules, never a link to another checkout's (`wt-no-switch-in-shared-checkout`, `wt-own-dependencies`).
3. **Know the base.** A branch starts from whatever the work builds on; the MR targets it, and you merge from it to stay current. Merge, don't rebase, a pushed branch (`wt-know-the-base`).
4. **Conventional Commits**, files staged by name, LF only (`commit-conventional`, `commit-stage-by-name`, `commit-lf-endings`).
5. **Env files with values are ignored**, lockfiles never (`ignore-env-with-values`, `ignore-never-shared-files`).
6. **Regenerate generated files** in a conflict; never merge them by hand.
7. **Nothing internal leaves in a public repo**: files, messages, branch names, author identity (`commit-identity-public`; for MRs, `gitlab-how-to`).
8. **Clean up straight after a merge**: worktree and branch removed, other worktrees synced (`wt-remove-after-merge`).
9. **Every platform.** Commands work on Linux, macOS and Windows; where they differ, the skills give each.

## Reviewing a repo or branch

Run the "Reviewing" section of each skill the change touches: `git-commit` (the commits in `<base>..HEAD`), `git-gitignore` (ignore files and tracked files), `git-worktree` (every worktree), and for the MR and pipeline the skills `gitlab-how-to` routes to. Each has its own `scripts/scan.sh`; report findings in the format of `agent-skills-authoring`, ordered by impact.
