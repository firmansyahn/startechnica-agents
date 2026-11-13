---
title: Commit to public repos with a noreply identity
impact: MEDIUM
tags: identity, public, privacy
check: review
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

**How to check:** `git log --format='%ae %ce' <base>..HEAD | sort -u` shows only the noreply address in a public repo.
