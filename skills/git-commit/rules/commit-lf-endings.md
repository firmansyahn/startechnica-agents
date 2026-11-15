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

**How to check:** `git ls-files --eol | grep -v 'i/lf\|i/-text\|i/none'` prints nothing.
