---
name: git-commit
description: "Use when committing in any team repo, or writing or reviewing a commit message: Conventional Commits 1.0.0 (type, scope = the component touched, breaking-change marker, body), staging files by name and never gitignored, credential or local-settings files, LF line endings and the .gitattributes that enforces them (and renormalising a CRLF repo as its own commit), [ci skip] only for commits that change no code, the author identity for public repos, checking the staged diff for internal details before a public push, and merging the target branch into a work branch instead of rebasing pushed history."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for git repositories hosted on GitLab.
metadata:
  author: firmansyahn
  version: "0.2.1"
---

# Committing

**Principle:** Every commit is small, staged by name, written as a Conventional Commit with LF endings, and safe to publish: nothing internal or secret reaches a public repo.

Every repo, old style or not, uses [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). That published spec is the reference; this skill adds the team's choices around it. Commits are small, staged by name, LF only, and safe for the repo's visibility.

GitLab's own agent skills (`glab`, and the `commit-messages` skill in gitlab-org/ai/skills, not vendored) describe GitLab's house style: capitalised subjects without a type. They also say to follow the repo's own convention, and here that is Conventional Commits.

Related: `git-worktree` (commit from your own worktree, not a shared checkout), `git-gitignore` (what is ignored, and untracking a committed file), `gitlab-mr` (the MR title follows the same format; what a public MR may not contain).

## 1. Stage

```sh
git status --short
git add <file> <file> ...          # by name
git diff --cached --stat && git diff --cached
```

- **Stage by name**, not `git add -A`/`git add .`, whenever anything is untracked: other sessions' files, notes, captures and local config sit in the same tree (`commit-stage-by-name`).
- **Never commit** gitignored files (`git add -f`), credentials, `.env*` with values, agent local settings (`.claude/settings.local.json`), or scratch notes.
- **One concern per commit.** A refactor, a fix and a formatting sweep are three commits.
- **Public repo or unsure?** Grep the staged diff and the message for the project's internal names, IPv4 addresses, emails and non-public domains before committing (`mr-no-internal-details-public`).

## 2. Write the message

```
<type>(<scope>): <description>

<body: what changed and why, wrapped at ~72; optional for a small change>

<footers: BREAKING CHANGE: ..., Refs: <issue>>
```

| Part | Rule |
|---|---|
| `type` | `feat`, `fix`, plus `build`, `chore`, `ci`, `docs`, `perf`, `refactor`, `revert`, `style`, `test` |
| `scope` | The component touched: the app, package, chart, module or top-level folder (`fix(web): ...`, `feat(billing): ...`, `ci(gitlab): ...`, `docs(plans): ...`). Omit it only when the change truly spans the repo |
| `description` | Imperative or plain present, lower case, no trailing period; says what changes for the reader, not which files were edited |
| Breaking | `!` before the colon (`feat(api)!: ...`) or a `BREAKING CHANGE: ...` footer |
| Body | Why, and anything the diff can't show (a decision, a trade-off, what was checked) |

A repo whose history uses an older style (`[chart] ...`, `chart: ...`) still gets Conventional Commits. A repo's own documented convention applies where it adds to the spec (what goes in the body, a ticket footer). → `commit-conventional`

Good: `fix(web): lighten the dark-mode destructive red so error text is readable`, `feat(monitoring)!: history is pruned after 180 days`, `docs(plans): record the owner's answers and add three units`.

## 3. `[ci skip]`

Append ` [ci skip]` only to a commit that changes no code and is pushed straight to a branch (docs, plans, agent files on the integration branch), so it starts no pipeline. Never on an MR branch's head commit with code: the MR then has no passing pipeline and can't be merged safely (`commit-ci-skip-without-code`).

## 4. Line endings

LF everywhere, on Windows too (`commit-lf-endings`):

- The repo has a `.gitattributes` with `* text=auto eol=lf`; propose one where it's missing.
- Write files with LF. `git diff --cached` showing `^M` or a whole-file change means CRLF crept in.
- Converting an existing CRLF repo is its own commit: `git add --renormalize .`, check `git diff --cached --ignore-cr-at-eol` is empty, and for deployable config check the rendered output is unchanged.

## 5. Author identity

`git config user.name` and `user.email` per repo when they differ from the global ones. For a public GitHub repo, commit with the GitHub noreply address (`<id>+<user>@users.noreply.github.com`), never a company or personal email: `git config --local user.email ...` (`commit-identity-public`).

## 6. Bringing in the target branch

When a work branch needs the target's newer commits, merge them in (`git fetch origin && git merge origin/<target>`). Don't rebase or amend commits that are already pushed and under review, and never force-push a shared branch without saying so. Rebasing local, unpushed commits is fine.

## Rules index

One file per rule in `rules/`; the file name is the rule ID. Sections and impact levels: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [commit-conventional](rules/commit-conventional.md) | Write Conventional Commits with the component as scope | LOW | scan |
| [commit-stage-by-name](rules/commit-stage-by-name.md) | Stage files by name; never commit ignored or secret files | HIGH | scan (secret and local files added in the range) |
| [commit-lf-endings](rules/commit-lf-endings.md) | Commit LF line endings, enforced by .gitattributes | LOW | scan (`.gitattributes`, `git ls-files --eol`) |
| [commit-ci-skip-without-code](rules/commit-ci-skip-without-code.md) | Use [ci skip] only on commits without code | MEDIUM | scan |
| [commit-identity-public](rules/commit-identity-public.md) | Commit to public repos with a noreply identity | MEDIUM | scan (`REPO_PUBLIC=1`) |
| [commit-no-backslash-escaped-backticks](rules/commit-no-backslash-escaped-backticks.md) | Do not backslash-escape backticks in text passed through PowerShell | MEDIUM | scan |

## Reviewing

1. **Scope:** the commits in `<base>..HEAD`, with the MR's target as base.
2. **Scan:** `bash <this skill>/scripts/scan.sh <base> [--strict]` from anywhere in the repo; add `REPO_PUBLIC=1` for a public repo (or one you can't confirm is private). Every line is a candidate: open the rule and confirm it.
3. **Read what the scan can't:** every added file belongs in the commit, each message says what changed and why, and the scope names the component touched.
4. **Report** each finding in the team's format (`agent-skills-authoring`), ordered by impact; raise it one level in a public repo:

   ```
   [HIGH] commit-stage-by-name  commit 3f2a91c
   .env.local was committed; remove it from the branch (git rm --cached), rotate anything it held, add it to .gitignore.
   ```

## Checklist

- [ ] `git status` read; files staged by name; staged diff read in full
- [ ] No ignored, credential, local-settings or notes files; public repo: no internal names, IPs, emails, domains
- [ ] `<type>(<scope>): <description>`; `!` or `BREAKING CHANGE:` when it breaks something
- [ ] LF only; `[ci skip]` only on a no-code commit pushed straight to a branch
