---
name: finishing-a-development-branch
description: "Use when implementation is complete and tests have passed, to verify branch state, choose the correct hosted integration workflow, finish a pull or merge request, and clean up without losing uncommitted work."
user-invocable: true
license: MIT
compatibility: Designed for coding agents and repositories using Git.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Finishing A Development Branch (team)

**Principle:** Finish only after verifying the exact branch, test results and repository workflow; never discard uncommitted work.

Related: [git-worktree](../git-worktree/SKILL.md) (branch and cleanup policy), [gitlab-mr](../gitlab-mr/SKILL.md) (GitLab merge requests).

## Team decisions

- Use the repository and forge instructions to choose between a pull request, merge request or local integration; do not assume one forge from the generic upstream menu.
- For worktrees and hosted merges, follow [git-worktree](../git-worktree/SKILL.md) and the forge-specific workflow. The project wins when it differs from upstream.
- Preserve the worktree and branch while hosted review is in progress; remove them only after the merge is confirmed and the worktree is safe to remove.

## In depth

The upstream guidance below is adapted from obra/superpowers `finishing-a-development-branch`; its source, pinned commit and license are recorded in [UPSTREAM.md](UPSTREAM.md). The team decisions above take precedence.

## Finishing a Development Branch

### Overview

**Core principle:** Verify tests → Detect environment → Present options → Execute choice → Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

### Step 1: Verify Tests

Run the project's full test suite with its documented package manager and commands. For team Next.js apps, follow [nextjs-package-manager](../nextjs-package-manager/SKILL.md) and use Yarn 4, not npm.

**If tests fail**, report the failures and stop — the menu comes after a green suite:

```
Tests failing (<N> failures). Must fix before completing:

[Show failures]
```

**If tests pass:** continue to Step 2.

### Step 2: Detect Environment

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
## Capture now, while still inside the workspace — Step 5 changes directory
## before cleanup (Step 6) needs this value
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

This determines which menu to show and how cleanup works:

| State | Menu | Cleanup |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON` (normal repo) | Standard 3 options | No worktree to clean up |
| `GIT_DIR != GIT_COMMON`, named branch | Standard 3 options | Provenance-based (see Step 6) |
| `GIT_DIR != GIT_COMMON`, detached HEAD | Reduced 2 options (no merge) | Externally managed — leave in place |

### Step 3: Determine Base Branch

The base branch is whatever this work forked from — usually named in the
plan, the conversation, or the branch's upstream. If it is not already
known, ask: "This branch split from <your best guess> - is that correct?"
Confirm before merging: merging into the wrong base is expensive to undo.

### Step 4: Present Options

Use the repository's forge instructions and [git-worktree](../git-worktree/SKILL.md) policy for the choices shown to the user. On this team, GitLab work must go through a merge request; do not present the upstream local-merge option.

```
Implementation complete. What would you like to do?

1. Push and create a merge request targeting <base-branch>
2. Keep the branch as-is (I'll handle it later)

Which option?
```

**Detached HEAD — follow the forge's supported flow and the team worktree policy; do not offer local integration.**

```
Implementation complete. You're on a detached HEAD (externally managed workspace). Follow the repository's merge-request workflow to publish a named branch, or keep the workspace as-is.
```

Present only choices allowed by the repository's workflow. Discarding the work happens only in response to the user explicitly asking for it (see "If your human partner asks to discard the work" below). Wait for their answer before taking an optional action.

### Step 5: Execute Choice

#### Local integration

Do not use this option when [git-worktree](../git-worktree/SKILL.md) or the repository requires merge requests. Otherwise, follow the project's explicit local integration procedure.

#### Option 1: Push and create a hosted review

```bash
git push -u origin <feature-branch>
## From a detached HEAD, name the new branch on the remote:
## git push origin HEAD:refs/heads/<new-branch>
```

Then create the pull/merge request against <base-branch> with the forge's
workflow skill and tooling, following the repository's template and
conventions, and report the URL to the user.

Keep the worktree — your human partner iterates on PR feedback there.

#### Option 2: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

#### If your human partner asks to discard the work

This path exists only as a response to an explicit request to throw the
work away. Confirm first:

```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for that exact confirmation. When it arrives:

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
```

Then clean up the worktree (Step 6) and force-delete the branch:

```bash
git branch -D <feature-branch>
```

### Step 6: Cleanup Workspace

**Runs for Option 1 and confirmed discards.** Options 2 and 3 always
preserve the worktree. Both callers have already changed directory to the
main repo root — worktree removal must run from outside the worktree —
and use the `GIT_DIR`/`GIT_COMMON`/`WORKTREE_PATH` values captured in
Step 2, from before that directory change.

**If `GIT_DIR == GIT_COMMON`:** Normal repo, no worktree to clean up. Done.

**If `WORKTREE_PATH` is under `.worktrees/` or `worktrees/`:** Superpowers
created this worktree — we own cleanup:

```bash
git worktree remove "$WORKTREE_PATH"
git worktree prune  # Self-healing: clean up any stale registrations
```

**If removal is refused** (`contains modified or untracked files`): the
worktree holds files that exist nowhere else — uncommitted plans, notes,
or scratch work. Never `--force` on your own initiative. Show your human
partner what is at stake and ask:

```bash
git -C "$WORKTREE_PATH" status --porcelain -uall
```

```
Worktree removal refused — these files were never committed:

<file list>

1. Commit them to <branch> before cleanup
2. Move them into <main repo root>
3. Delete them (unrecoverable)

Which?
```

Carry out the choice, then remove the worktree.

**Otherwise:** The host environment owns this workspace — leave it in
place. If your platform provides a workspace-exit tool, use it.

### Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | yes | - | - | yes |
| 2. Create PR | - | yes | yes | - |
| 3. Keep as-is | - | - | yes | - |
| Discard (explicit request only) | - | - | - | yes (force) |

### Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Tests passed earlier this session" | Run the suite on the tree you are about to integrate. A green run only proves the tree it ran on. |
| "They obviously want it merged" | Integration is your human partner's decision. Present the menu and wait. |
| "They seem done with this feature — I'll offer to discard it" | The menu is complete as written. Discard happens only when your human partner asks for it in so many words. |
| "'Yeah, get rid of it' counts as confirmation" | Only the typed word `discard` authorizes deletion. |
| "The PR is up, so the worktree is clutter now" | PR feedback gets fixed in that worktree. It stays until the work lands. |
| "This other worktree looks stale — I'll clean it too" | Clean up only worktrees under `.worktrees/` or `worktrees/`. Everything else belongs to the host. |
| "Removal refused — `--force` is just finishing the cleanup" | The refusal means files exist only in that worktree. `--force` destroys them permanently. Show your human partner and ask. |
| "The merged-result failure is probably flaky" | A failing merged result stops everything. Branch and worktree stay put while you investigate. |
| "The base branch is obviously main" | Confirm the fork point or ask. Merging into the wrong base is expensive to undo. |
| "The push was rejected — force-push will fix it" | A rejected push means the remote moved. Investigate; force-push only on your human partner's explicit request. |
