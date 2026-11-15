---
title: Commit LF line endings, enforced by .gitattributes
impact: LOW
tags: line-endings, windows, gitattributes
check: scan, review
---

## Commit LF line endings, enforced by .gitattributes

**Impact: LOW** (whole-file diffs that hide the real change; shell scripts and hooks that fail with `\r` in Linux containers)

Files are LF, written that way on Windows too. Each repo has a `.gitattributes` with `* text=auto eol=lf`. Converting a repo that already has CRLF files is a separate commit made with `git add --renormalize .`, checked with `git diff --cached --ignore-cr-at-eol` (empty) and, for deployable config, an unchanged rendered output.

**Incorrect:**

```sh
# no .gitattributes; an editor saves CRLF; the commit rewrites every line
git commit -am "fix(chart): bump the image tag"
```

**Correct:**

```sh
printf '* text=auto eol=lf\n' > .gitattributes
git add .gitattributes && git commit -m "build: keep line endings LF"
git add --renormalize . && git diff --cached --ignore-cr-at-eol --stat   # empty
git commit -m "style: convert line endings to LF"
```

**How to check:** `scripts/scan.sh` reports a missing `* ... eol=lf` line in `.gitattributes` and every tracked file committed with CRLF or mixed endings (`git ls-files --eol` shows `i/crlf` or `i/mixed`). With that `.gitattributes`, git itself stores new text files as LF, so no hook is needed. Whether a renormalisation went in as its own commit, with an empty `git diff --cached --ignore-cr-at-eol` and an unchanged rendered output for deployable config, stays review.
