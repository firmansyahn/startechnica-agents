---
name: git-gitignore
description: "Use when adding, changing or reviewing a .gitignore, or when a file shows up in git status that shouldn't (or is missing from it): which file a pattern belongs in (the repo's .gitignore, a nested one per app, .git/info/exclude for your own clone, the global excludes file), writing precise patterns (anchoring with a leading slash, a trailing slash for folders, ** and negation, and why a file in an ignored folder can't be re-included), what every repo ignores (dependencies, build output, binaries, caches, local databases, env files with values, local agent settings, test reports, worktree folders, common OS and editor files) and what it never ignores (lockfiles, committed tool releases, .env.example), untracking a file that is already committed, debugging with git check-ignore, and keeping .dockerignore and other tools' ignore files in step. Works on Linux, macOS and Windows."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for any git repository.
metadata:
  author: firmansyahn
  version: "0.1.1"
---

# Ignoring files in git

**Principle:** Ignore what the repo's tools generate and what holds secrets, with the narrowest pattern that works, and never a file the project needs to install, build or run.

The reference is git's own documentation, [gitignore(5)](https://git-scm.com/docs/gitignore); starting points for a language's patterns are GitHub's [github/gitignore](https://github.com/github/gitignore) templates (CC0), trimmed to what the repo actually produces. This skill adds where each pattern goes, the shapes that hold up, and the checks. No established agent skill covers this well enough to vendor, so it is the team's own.

Related: `git-commit` (stage by name, never `git add -f` an ignored file), `git-worktree` (the `.worktrees/` folder and the other ignore files that need it), `nextjs-deploy` (the image's `.dockerignore`).

Details: [references/patterns-and-tools.md](references/patterns-and-tools.md) (pattern syntax, `.dockerignore` and other ignore files, case sensitivity, debugging). A starting file: [assets/gitignore](assets/gitignore).

## When to use

- A new repo or app needs a `.gitignore`, or a tool starts writing files into the tree
- `git status` shows a file that shouldn't be committed, or doesn't show one that should
- A pattern doesn't work (a negation that never re-includes, a name that matches too much)
- A file that should be ignored is already committed
- Reviewing a change to `.gitignore`, `.dockerignore` or another tool's ignore file

## 1. Pick the file

| What | Where | Shared? |
|---|---|---|
| What the repo's own tools produce for everyone: dependencies, build output, binaries, caches, local databases, test reports, env files with values, local settings files the tools write; and the common OS and editor files (`.DS_Store`, `Thumbs.db`, `*.swp`, `.vscode/`, `.idea/`) | The repo's `.gitignore` | Yes, committed |
| The same, for one app in a repo with several | `<app>/.gitignore`, patterns relative to that folder | Yes, committed |
| Your own scratch files in this clone, a tool only you run, notes | `.git/info/exclude` (same syntax) | No, this clone only |
| Anything else only your machine makes, in every repo (another editor's files, a personal tool) | The global excludes file: `~/.config/git/ignore`, or `git config --global core.excludesFile <path>` | No, your machine |

- The project file lists what the repo's tools make, plus the common OS and editor files, so a clone is clean whatever the machine. One person's notes and tools go in `.git/info/exclude` or the global file, not here (`ignore-personal-files-elsewhere`).
- A team that commits shared editor settings (`.vscode/settings.json`, `.vscode/extensions.json`) ignores the rest with `.vscode/*` and negations instead of `.vscode/`.
- A tool that writes into the tree on every machine (a framework's `.next/`, a test runner's report folder) belongs in the project file, even when not everyone runs it.

## 2. Write the pattern

- **Anchor what lives in one place:** `/dist/` ignores the root's `dist` only; `dist/` ignores a `dist` folder at any depth; `dist` (no slash) also matches a *file* named `dist` anywhere (`ignore-anchor-paths`).
- **Trailing slash for folders:** `logs/` matches folders only.
- **`**`** matches across folders: `**/coverage/`, `docs/**/*.png`.
- **To keep one file in an ignored folder, ignore the folder's contents, not the folder:** `.yarn/*` then `!.yarn/releases`. After `.yarn/` the negation never applies: git doesn't look inside an excluded folder (`ignore-reinclude-with-star`).
- **One concern per block, with a comment** saying which tool writes it (`# Playwright reports`), so the next person knows when it can go.
- Forward slashes on every platform; LF line endings like any other file.

## 3. What every repo ignores, and never ignores

**Ignore** (when the repo has them; the full list, with binaries, local databases, Yarn and OS files, is [assets/gitignore](assets/gitignore)):

```gitignore
# dependencies and build output
node_modules/
.next/
dist/
bin/
*.tsbuildinfo
# env files with values; the example is committed
.env
.env.*
!.env.example
# test reports and coverage
/coverage/
/test-results/
# local agent and tool settings
.claude/settings.local.json
# branch worktrees (git-worktree)
/.worktrees/
# OS and editor files
.DS_Store
Thumbs.db
*.swp
.vscode/
.idea/
```

**Never ignore** (`ignore-never-shared-files`): lockfiles (`yarn.lock`, `package-lock.json`, `pnpm-lock.yaml`, `go.sum`, `Cargo.lock`, `uv.lock`, `poetry.lock`), a committed tool release (`.yarn/releases/`), `.env.example`, `.gitattributes`, and any generated file the repo commits on purpose (generated API types, a vendored folder the project chose to commit). Env files with values are the reverse: always ignored (`ignore-env-with-values`).

## 4. A file that is already committed

Ignoring changes nothing for a tracked file: git keeps tracking it. Untrack it in the same commit as the pattern (`ignore-untrack-when-ignoring`):

```sh
git rm --cached -r -- <path>        # keeps the file on disk, removes it from the index
git add .gitignore
git commit -m "chore: stop tracking <path>"
```

- List tracked files that the repo's `.gitignore` files match: `git ls-files -ci --exclude-per-directory=.gitignore`. With `--exclude-standard` instead, it also counts this clone's `.git/info/exclude` and your global excludes, which nobody else has.
- A secret that was committed stays in history: untracking is not enough. Rotate it, and see `git-commit` (`commit-stage-by-name`).
- Other clones delete the file on their next pull, because git removes what the commit removed. Say so in the commit body when the file holds local state people need (they copy it first).

## 5. Debug a pattern

```sh
git check-ignore -v <path>              # which file and line ignores it (nothing printed: not ignored)
git check-ignore -v --no-index <path>   # the same for a tracked file
git status --ignored --short            # what is ignored right now
git clean -ndX                          # what a clean of ignored files would delete (dry run)
```

## 6. Keep the other ignore files in step

When a pattern is about size or secrets (dependencies, env files, captures, worktrees, build output), add it to the other ignore files the repo has (`ignore-keep-other-ignores-in-step`):

- **`.dockerignore`**: patterns are relative to the build context and a bare name matches only at its root, so `node_modules` there is `**/node_modules` here. A secret missing from `.dockerignore` ends up in an image layer.
- A code indexer's or linter's ignore file, editor exclusions: see `git-worktree` ("keeping `.worktrees/` out").

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [ignore-env-with-values](rules/ignore-env-with-values.md) | Ignore env files with values; commit the example | HIGH | scan (tracked env files, env files no rule ignores) |
| [ignore-never-shared-files](rules/ignore-never-shared-files.md) | Never ignore lockfiles, committed tool releases or the env example | HIGH | scan (`git check-ignore` on lockfiles, `.yarn/releases`, env examples) |
| [ignore-untrack-when-ignoring](rules/ignore-untrack-when-ignoring.md) | Untrack a committed file in the commit that ignores it | HIGH | scan (`git ls-files -ci --exclude-per-directory=.gitignore`) |
| [ignore-keep-other-ignores-in-step](rules/ignore-keep-other-ignores-in-step.md) | Add size and secret patterns to .dockerignore too | MEDIUM | review |
| [ignore-reinclude-with-star](rules/ignore-reinclude-with-star.md) | Ignore a folder's contents, not the folder, to keep a file in it | MEDIUM | scan (a negation under a folder excluded with `dir/`) |
| [ignore-anchor-paths](rules/ignore-anchor-paths.md) | Anchor paths that live in one place; slash-terminate folders | LOW | review |
| [ignore-personal-files-elsewhere](rules/ignore-personal-files-elsewhere.md) | Keep one person's files out of the project ignore file | LOW | review |

## Reviewing

1. **Scope:** a change to `.gitignore` or another ignore file, or the whole checkout.
2. **Scan:** `bash <this skill>/scripts/scan.sh [--strict]` from anywhere in the repo (other worktrees nested in it are skipped). Every line is a candidate: open the rule and confirm it with `git check-ignore -v`.
3. **Read what the scan can't:** `ignore-anchor-paths`, `ignore-personal-files-elsewhere` and `ignore-keep-other-ignores-in-step` on each changed pattern.
4. **Report** each finding in the team's format (`agent-skills-authoring`), ordered by impact.

## Review checklist

- [ ] Each new pattern is in the right file (project, app folder, `.git/info/exclude`, global)
- [ ] Root-only paths anchored with `/`; folders end in `/`; a comment names the tool
- [ ] Negations re-include from `dir/*`, never from an excluded `dir/`
- [ ] Env files with values ignored, `.env.example` committed; lockfiles and tool releases not ignored
- [ ] `git ls-files -ci --exclude-per-directory=.gitignore` prints nothing (or each file is untracked in this change)
- [ ] `.dockerignore` and other ignore files have the size and secret patterns too
