---
name: git-worktree
description: "Team overlay on the vendored worktree skills: read it with git-using-worktrees (creating a workspace), finishing-a-development-branch (ending the work) and git-resolve-conflicts (merge conflicts) whenever you start branch work, work beside other agent sessions, finish or clean up a branch, or hit a conflict. It sets what those skills leave open: worktrees in .worktrees/<topic> branched from whatever base the work builds on (HEAD or a named ref) with CI-friendly names, the MR targeting that base, every worktree's own dependencies (its own yarn install and Go modules; never a node_modules or vendor link, or a replace/go.work pointing at another checkout), gitignored local files via .worktreeinclude, finishing only through a merge request, removing the worktree and branch once the MR merged (links and processes first, on Linux, macOS and Windows), keeping .worktrees/ out of Docker contexts, indexers and editors, and regenerating generated files during conflicts."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for git repositories hosted on GitLab.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# Worktrees: the team's overlay

**Principle:** One worktree per independent piece of work, with a known base and its own dependencies, removed with its branch once the merge request is merged and nothing in it is unsaved.

The workflow comes from established skills, vendored unchanged beside this one (updated as `agent-skills-authoring` describes). Follow them; this file only adds what they leave to the project, and wins where it says something different.

| Step | Upstream skill | What the team sets |
|---|---|---|
| Start isolated work | [git-using-worktrees](../git-using-worktrees/SKILL.md) (obra/superpowers) | Section 1 |
| Make it runnable | git-using-worktrees, Step 2 | Section 2 |
| Finish the branch | [finishing-a-development-branch](../finishing-a-development-branch/SKILL.md) (obra/superpowers) | Section 3 |
| Merge conflicts | [git-resolve-conflicts](../git-resolve-conflicts/SKILL.md) (tailcallhq/forgecode) | Section 4 |
| MR, pipeline, merge | [gitlab-glab](../gitlab-glab/SKILL.md), [gitlab-pipeline-watch](../gitlab-pipeline-watch/SKILL.md), [gitlab-stacked-mrs](../gitlab-stacked-mrs/SKILL.md) (GitLab) | `gitlab-mr` |

Everything here works on Linux, macOS and Windows; the few platform differences (what deletes through a link, how to remove one, what a running process does to a removal) and the hooks are in [references/platforms-and-hooks.md](references/platforms-and-hooks.md).

## 1. Start: declared preferences for git-using-worktrees

These count as the user's "declared preference", so don't ask about them:

- **Isolate by default.** Branch work happens in a worktree whenever the checkout isn't yours alone. Never `git switch` a checkout that has changes you didn't make (`wt-no-switch-in-shared-checkout`).
- **Directory:** `.worktrees/<topic>` at the repo root. A worktree made by the harness's own tool (Claude Code puts them in `.claude/worktrees/`) is fine too; don't move it.
- **Base: whatever the work builds on**, which can be any ref: `HEAD` (upstream's default, and what the harness's own tool uses with `worktree.baseRef: "head"`), the integration branch, another MR's branch in a stack, a release branch. Use the ref the user names; otherwise keep upstream's default. Never reset a worktree onto a different base on your own. Note the base, because it is the MR's target and the branch you merge from later (`wt-know-the-base`):

  ```sh
  git worktree add -b feat/<topic> .worktrees/<topic>            # from HEAD
  git worktree add -b feat/<topic> .worktrees/<topic> <base-ref>  # from a named ref (fetch it first if it's remote)
  ```
- **Branch name** with a CI type prefix (`feat/`, `fix/`, `chore/`, `refactor/`, `docs/`), so the pipeline treats it as a work branch (`gitlab-ci`).

### Keep `.worktrees/` out of everything that walks the tree

Upstream checks `.gitignore`. Git doesn't recurse into worktrees (each `.worktrees/<topic>` holds only tracked files, and the main checkout treats it as a nested repository), but every tool that walks the folders from the repo root sees one full copy of the repo per worktree, `node_modules` included. Exclude it once in each:

| File | Entry | Without it |
|---|---|---|
| `.gitignore` | `/.worktrees/` | `git status` lists every worktree; `git add -A` tries to add them as embedded repos |
| `.dockerignore` (build context at the repo root) | `.worktrees` and `.claude/worktrees` | A local `docker build .` sends every worktree as context (CI clones have none) |
| A code indexer's ignore file (`.gitnexusignore`, ...) | `/.worktrees/` | Every symbol is indexed once per worktree |
| Editor settings (`files.watcherExclude`, `search.exclude`) | `**/.worktrees/**` | The editor watches and indexes every copy |
| Root-level tool configs with `**` globs | exclude `.worktrees/**` | Lint and type-check run over every copy |

## 2. Make it runnable: instead of upstream's Step 2

- **Dependencies: every worktree has its own**, resolved from its own manifest and lockfile, not even shared "just to run tests" (`wt-own-dependencies`):
  - **Node:** `yarn install --immutable` in each app folder (never `npm install`; see `nextjs-package-manager`). Never a symlink or junction to another checkout's `node_modules`.
  - **Go:** `go mod download` in the module folder, then build and test with the worktree's own `go.mod`/`go.sum`. The shared module and build caches are fine. Never a symlinked `vendor/`, and no `replace` or `go.work` pointing at another checkout's path.
- **Gitignored local files** (`.env`, `.claude/settings.local.json`): listed in `.worktreeinclude`, one plain path per line. Claude Code copies them into its own worktrees; the [assets/post-checkout](assets/post-checkout) hook copies them into the others. Never commit them.
- **Baseline:** run the checks of the app you'll change (`yarn typecheck && yarn test`, `go test ./...` in the module), with a timeout long enough that test databases shut down (`go test -timeout 30m`).
- **A second dev server** needs its own port (`PORT=3001 yarn dev`).

## 3. Finish: finishing-a-development-branch, MR only

- **Always option 2, "Push and create a Pull Request"**, done the GitLab way (`gitlab-mr`). Never option 1: merging into the base locally skips the MR pipeline. Option 3 (keep) is fine while the MR is in review.
- **After the MR merged**, clean up straight away, without asking (`wt-remove-after-merge`), one step per command. Upstream's Step 6 applies (worktrees under `.worktrees/` are ours to remove; never `--force` over uncommitted files, list them and ask), with these steps around it:
  1. Confirm the merge: the MR is `merged` and `git branch -r --contains <merge commit>` lists `origin/<the MR's target>`.
  2. Stop the processes running from the worktree: dev server, watchers, leftover test databases (`wt-stop-processes-before-remove`).
  3. Check there's no `node_modules` or `vendor` link; if an older tool left one, remove the link alone and check it's gone (`wt-unlink-before-remove`; commands per platform in the reference).
  4. From the main checkout: `git worktree remove .worktrees/<topic>`, then `git worktree prune`.
  5. `git branch -D feat/<topic>` (upstream's `-d` refuses, because the MR's merge commit isn't on your local copy of the target); `git ls-remote --heads origin feat/<topic>` prints nothing.
  6. **Sync the other open worktrees** whose base is the branch that just moved: `git fetch origin && git merge origin/<their base>` in each, now, while the conflicts are small (section 4).

## 4. Conflicts: git-resolve-conflicts, with the team's generated files

- **Merge, don't rebase** a pushed branch: `git fetch origin && git merge origin/<base>` (the MR's target). Then follow `git-resolve-conflicts`.
- **Generated files are regenerated, never merged by hand** (upstream's principle 4). Each project lists its generated files and the commands that rebuild them in its `AGENTS.md`; take either side, run the commands on the merged code, and stage the result.
- **Turn on rerere** once per clone (`git config rerere.enabled true`): every worktree shares it, so a conflict resolved once is reapplied the next time.
- Fewer conflicts start before the merge: small MRs merged in order (`gitlab-stacked-mrs` for dependent work), and the sync in section 3, step 6.

## Rules index

Team rules on top of the upstream skills. One file per rule in `rules/`; the file name is the rule ID. Sections and impact levels: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [wt-no-switch-in-shared-checkout](rules/wt-no-switch-in-shared-checkout.md) | Don't switch branches in a checkout someone else is using | HIGH | hook, review |
| [wt-know-the-base](rules/wt-know-the-base.md) | Know the branch's base, and target the MR at it | MEDIUM | review (`git log --oneline origin/<target>..HEAD`) |
| [wt-own-dependencies](rules/wt-own-dependencies.md) | Give each worktree its own dependency install | HIGH | scan (`node_modules`/`vendor` links, `replace`/`go.work` paths, `.worktrees/` not ignored), hook, review |
| [wt-unlink-before-remove](rules/wt-unlink-before-remove.md) | Remove links alone, and check, before removing the worktree | CRITICAL | hook (`guard-worktree-remove.mjs`) |
| [wt-stop-processes-before-remove](rules/wt-stop-processes-before-remove.md) | Stop processes running from the worktree before removing it | MEDIUM | hook, review |
| [wt-remove-after-merge](rules/wt-remove-after-merge.md) | Remove the worktree and its branch once the MR merged | LOW | scan (worktree folders that are gone), review (`git worktree list`) |

## Reviewing

1. **Scope:** the repo and every worktree (`git worktree list`).
2. **Scan:** `bash <this skill>/scripts/scan.sh [--strict]` from anywhere in the repo. Every line is a candidate: open the rule and confirm it.
3. **Read what the scan can't:** each worktree's base and whether its MR targets it (`wt-know-the-base`), whether a worktree or branch the scan lists as gone upstream really merged (`wt-remove-after-merge`), and whether the repo installed the hooks (`guard-worktree-remove.mjs`, `guard-shared-checkout.mjs`) or relies on review.
4. **Report** each finding in the team's format (`agent-skills-authoring`), ordered by impact.

## Enforce it in Claude Code

Two `PreToolUse` hooks for the `Bash` tool (Node; Linux, macOS and Windows). Copy them to `tools/agent-hooks/` and register them in `.claude/settings.json`:

- [assets/hooks/guard-worktree-remove.mjs](assets/hooks/guard-worktree-remove.mjs) refuses `git worktree remove` while any `node_modules` or `vendor` in the target (up to three levels down) is a link, naming the platform's way to remove it, and then while a process runs from the target (its path in the command line; on Linux and macOS also its working directory), listing the pids. `REMOVE_WITH_PROCESSES=1` in front lets a removal through when those processes aren't the worktree's.
- [assets/hooks/guard-shared-checkout.mjs](assets/hooks/guard-shared-checkout.mjs) refuses a branch switch (`git switch`, `git checkout <branch>` or `-b`, `glab mr checkout`, `gh pr checkout`) in the main checkout while it has uncommitted or untracked files, and points to `git worktree add`. Restoring files and linked worktrees pass; `SWITCH_SHARED=1` in front lets a deliberate switch through.

```json
{ "matcher": "Bash", "hooks": [
  { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-worktree-remove.mjs\"", "timeout": 20 },
  { "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/tools/agent-hooks/guard-shared-checkout.mjs\"", "timeout": 20 }
] }
```

[assets/post-checkout](assets/post-checkout) goes in the repo's hooks folder (`tools/git-hooks/post-checkout`, enabled once per clone with `git config core.hooksPath tools/git-hooks`), next to a `.worktreeinclude` like [assets/worktreeinclude](assets/worktreeinclude).

## Checklist

- [ ] In `.worktrees/<topic>` (or the harness's own worktree), on a `feat/`/`fix/`/... branch; its base noted (the MR's target)
- [ ] `.worktrees/` ignored in `.gitignore`, `.dockerignore`, the code indexer and the editor
- [ ] The worktree's own `yarn install` and Go modules; no `node_modules`/`vendor` link, no `replace` or `go.work` pointing outside it; local files copied, not committed
- [ ] Finished through an MR; after the merge: processes stopped, no links, worktree removed, branch deleted, other worktrees synced
