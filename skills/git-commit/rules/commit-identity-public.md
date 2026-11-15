---
title: Commit to public repos with a noreply identity
impact: MEDIUM
tags: identity, public, privacy
check: scan (`REPO_PUBLIC=1`), hook, review
---

## Commit to public repos with a noreply identity

**Impact: MEDIUM** (a company or personal email is published in every commit and can't be removed without rewriting history)

A commit records the author's and committer's email. In a public GitHub repo, use the GitHub noreply address, set for that repo only, before the first commit. Check the identity whenever you commit in a repo whose visibility you haven't checked.

**Incorrect:**

```sh
git commit -m "docs: add the README"     # global user.email is the work address
```

**Correct:**

```sh
git config --local user.email "<id>+<user>@users.noreply.github.com"
git commit -m "docs: add the README"
```

**How to check:** `scripts/scan.sh` with `REPO_PUBLIC=1` lists commits in `<base>..HEAD` whose author or committer email isn't a noreply address. The `assets/hooks/pre-commit` git hook finds the visibility itself (`gh repo view`) for a repo whose origin is on github.com, and refuses a commit without the noreply address when the repo is public or `gh` can't tell (`COMMIT_IDENTITY_OK=1` in front after checking it's private). Neither covers a public repo on another host, or the name in `user.name`: review those, with `git log --format='%an %ae %cn %ce' <base>..HEAD | sort -u`.
