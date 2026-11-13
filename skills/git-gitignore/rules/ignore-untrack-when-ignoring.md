---
title: Untrack a committed file in the commit that ignores it
impact: HIGH
tags: index, tracked-files
check: scan, review
---

## Untrack a committed file in the commit that ignores it

**Impact: HIGH** (the pattern does nothing for a tracked file: it keeps being committed, and everyone believes it isn't)

Ignore rules only apply to untracked files. When a pattern covers a file that is already committed, remove it from the index with `git rm --cached` in the same commit, or narrow the pattern if the file should stay tracked. A file that was force-added (`git add -f`) is the same case. If the file held a secret, untracking is not enough: rotate it.

**Incorrect:**

```sh
echo "build.json" >> .gitignore
git commit -am "chore: ignore build.json"      # build.json is still tracked
```

**Correct:**

```sh
echo "/build.json" >> .gitignore
git rm --cached -- build.json
git add .gitignore
git commit -m "chore: stop tracking build.json"
```

**How to check:** `git ls-files -ci --exclude-per-directory=.gitignore` prints the tracked files that the repo's `.gitignore` files match (`--exclude-standard` also counts this clone's `.git/info/exclude` and the global excludes, which don't travel with the repo); the skill's `scripts/scan.sh` reports them.
