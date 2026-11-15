---
title: Stop processes running from the worktree before removing it
impact: MEDIUM
tags: worktree, processes, cleanup
check: hook, review
---

## Stop processes running from the worktree before removing it

**Impact: MEDIUM** (Windows: the removal fails halfway, leaving a half-deleted folder and a stale worktree entry. Linux and macOS: the removal succeeds, but orphaned processes keep running from a deleted folder, holding ports and test databases)

A dev server, a watcher, or a test database a timed-out test run left behind keeps running from the worktree. Find the processes started from it, stop your own (not other sessions'), then remove it. Give long test suites a timeout that lets them finish (`go test -timeout 30m`) so they clean up after themselves.

**Incorrect:**

```sh
git worktree remove .worktrees/x      # next dev and two test postgres servers still running from it
```

**Correct** (Linux, macOS):

```sh
pgrep -af '.worktrees/x'              # or: lsof +D .worktrees/x
kill <pid>
```

**Correct** (Windows, PowerShell):

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*.worktrees\x*' } | Select-Object ProcessId, Name
taskkill /PID <pid> /T /F
```

Then:

```sh
git worktree remove .worktrees/x
```

**How to check:** the `guard-worktree-remove.mjs` hook (`assets/hooks/`) refuses `git worktree remove` while a process's command line names the worktree's path (every platform) or, on Linux and macOS (with `lsof`), its working directory is inside it, and lists the pids. On Windows it misses a process that only `cd`'d in and was started with a relative path; `REMOVE_WITH_PROCESSES=1` in front lets a removal through when the processes it names aren't running from the worktree. Whose processes they are is yours to decide: stop your own only. After removal, the folder is gone, `git worktree list` doesn't show it, and `pgrep -af '.worktrees/x'` (or the PowerShell query) finds nothing.
