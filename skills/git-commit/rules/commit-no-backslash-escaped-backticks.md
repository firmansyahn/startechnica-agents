---
title: Do not backslash-escape backticks in text passed through PowerShell
impact: MEDIUM
tags: powershell, quoting, commit-message, pr-body
check: scan (backslash-backtick in a commit subject or body)
---

## Do not backslash-escape backticks in text passed through PowerShell

**Impact: MEDIUM** (the published message shows stray backslashes around every code span)

PowerShell's escape character is the backtick, not the backslash. Markdown-style escaping written for a POSIX shell (`\`code\``) passes the backslashes through literally, so a commit message or PR/MR body set through `git commit -m "..."`, `gh pr create --body "..."` or `glab` ends up with `\`code\`` instead of `` `code` ``.

Plain backticks inside a double-quoted PowerShell string are safe: a backtick only escapes when followed by `` ` ``, `$` or `"``. For a long body, avoid quoting entirely with `--body-file` (or `-F` for git): write the file with LF and UTF-8 without BOM, then pass it.

**Incorrect (what's wrong):**

```powershell
gh pr create --title "fix: use \`go-testing\` rules" --body "Adds the \`go-testing\` scan."
```

**Correct:**

```powershell
gh pr create --title "fix: use `go-testing` rules" --body "Adds the `go-testing` scan."
# or, for a long body:
gh pr create --title "fix: use go-testing rules" --body-file .git/pr-body.md
```

**How to check:** `bash <this skill>/scripts/scan.sh <base>` flags backslash-backtick sequences in commit subjects and bodies; read the rendered PR/MR description after posting.
