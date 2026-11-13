# Worktrees on Linux, macOS and Windows, and the hooks

Everything in the skill works the same on every platform except the three things below: what deletes through a link, how to remove one, and what a running process does to a removal. Commands are given for Linux and macOS (any POSIX shell) and for Windows (Git Bash and PowerShell).

## Why links are dangerous

A link (a symlink, or on Windows a junction) that lets a worktree reuse another checkout's `node_modules` looks like a normal folder to most tools:

| What happens | Linux, macOS | Windows |
|---|---|---|
| `yarn install` in the worktree | Writes through the link into the other checkout's packages | Same |
| `git worktree remove` (with or without `--force`) | Removes the link only; the target survives (checked with git 2.43) | Git for Windows treats the junction as a folder and deletes the other checkout's packages. This has emptied a main checkout's `node_modules` three times |
| `rm -rf <worktree>/node_modules/` **with a trailing slash**, or `rm -rf <link>/*` | Deletes the target's contents | Same |
| `rm -rf <worktree>` | Removes the link only | Can follow a junction, depending on the tool |

So: every worktree runs its own `yarn install`, and nobody makes a link (`wt-own-dependencies`). The rest of this section is only for cleaning up a link an older tool or session left behind: remove the link itself, alone, and check.

## Finding and removing a link

Find them (both platforms; Git Bash reports junctions as links too):

```sh
find .worktrees/<topic> -maxdepth 3 -name node_modules -prune -type l
```

Remove the link, never what it points at:

| Platform | Command |
|---|---|
| Linux, macOS | `rm .worktrees/<topic>/node_modules` or `unlink .worktrees/<topic>/node_modules`: **no trailing slash**, no `-r` |
| Windows, Git Bash | `MSYS2_ARG_CONV_EXCL='*' cmd /c "rmdir \"$(cygpath -w "$PWD/.worktrees/<topic>/node_modules")\""`. `rmdir` on a junction removes the link only. Git Bash rewrites arguments that look like paths (and `/J`-style flags) before `cmd` sees them, and typed backslashes get mangled, hence `MSYS2_ARG_CONV_EXCL` and `cygpath -w` |
| Any, with Node | `node -e "require('fs').unlinkSync('.worktrees/<topic>/node_modules')"` (forward slashes; removes a link and fails on a real folder, which makes it the safest) |

Then, in a separate command, check before going on:

```sh
[ ! -e .worktrees/<topic>/node_modules ] && echo gone
```

## Processes still running from a worktree

| | Linux, macOS | Windows |
|---|---|---|
| Effect on removal | The removal succeeds, but the processes keep running from a deleted folder: a dev server still holds its port, a test database still runs, a watcher may recreate files | The removal fails halfway ("Device or resource busy", "Permission denied"), leaving a half-deleted folder and a stale worktree entry |
| Find them | `pgrep -af '.worktrees/<topic>'`; `lsof +D .worktrees/<topic>` (open files and working directories; slow on big trees) | `Get-CimInstance Win32_Process \| Where-Object { $_.CommandLine -like '*.worktrees\<topic>*' } \| Select-Object ProcessId, Name, CommandLine` (PowerShell) |
| Stop one | `kill <pid>` (then `kill -9 <pid>` if it ignores it) | `taskkill /PID <pid> /T /F` (Git Bash: `taskkill //PID <pid> //T //F`) |

Usual culprits on every platform:

- A dev server (`next dev`, `go run`) started from the worktree.
- Test databases a test run started and didn't stop: a `go test` that timed out or panicked leaves its private PostgreSQL running. Run long suites with `-timeout 30m` so they finish.
- Editors and language servers with the folder open.

Stop only your own processes; leave other sessions' alone unless the user says otherwise.

## The post-checkout hook

[../assets/post-checkout](../assets/post-checkout) is POSIX `sh` (Linux, macOS, Git Bash). It runs after `git worktree add` (and every checkout). In a worktree that isn't the main checkout, it copies each path listed in the main checkout's `.worktreeinclude` that the worktree lacks, never overwriting. That gives worktrees made by `git worktree add` or by other agent tools the same local files Claude Code copies into its own.

Enable it once per clone: `git config core.hooksPath tools/git-hooks`, and commit it executable (`git update-index --chmod=+x tools/git-hooks/post-checkout`; on Linux and macOS a hook without the executable bit is ignored, with a warning). Hooks are repo config, so every worktree runs them.

Variations a project may need:

- **A tracked file a branch predates** (an agent settings file added after the branch was cut): copy it too, and list it in `$(git rev-parse --git-common-dir)/info/exclude` so it's never committed from that branch. A later checkout that brings the tracked file replaces it.
- **Paths inside a copied config that point at the project dir** (hook commands using `$CLAUDE_PROJECT_DIR`) can be rewritten to the main checkout's path, so a branch without those scripts still runs them.
- **Background jobs after checkout** (refreshing a code index) go at the end, detached, and never fail the checkout (`exit 0`).

## The guard hook

[../assets/hooks/guard-worktree-remove.mjs](../assets/hooks/guard-worktree-remove.mjs) (Node, any platform) reads the Bash command Claude Code is about to run. For each `git worktree remove <path>` (also after `cd` or `git -C`), it resolves the path and looks for a `node_modules` that is a link, up to three levels down. If it finds one it exits 2 with the platform's fix, which refuses the call. On Linux and macOS git itself wouldn't follow the link, but the hook refuses there too: a link means the worktree broke `wt-own-dependencies`, and the next `rm -rf <link>/` would. It only checks commands at a command position, so the same words inside a quoted string (a commit message) don't trip it.
