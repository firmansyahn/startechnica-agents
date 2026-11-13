---
title: Remove links alone, and check, before removing the worktree
impact: CRITICAL
tags: worktree, symlink, junction, removal
check: hook
---

## Remove links alone, and check, before removing the worktree

**Impact: CRITICAL** (another checkout's `node_modules` or `vendor` is emptied while its dev server runs)

A worktree shouldn't contain links to another checkout (`wt-own-dependencies`), but an older tool or session may have left one. What deletes through it depends on the platform: on Windows, `git worktree remove` follows a junction; on every platform, `rm -rf <link>/` with a trailing slash (or `rm -rf <link>/*`) deletes the target's contents. So remove each link by itself, in its own command, confirm it's gone, and only then remove the worktree in a later command. Never chain them: if the unlink fails, the removal still runs.

**Incorrect:**

```sh
rm -rf .worktrees/x/node_modules/ && git worktree remove .worktrees/x              # trailing slash: empties the target
cmd //c "rmdir C:\work\<repo>\.worktrees\x\web\node_modules" ; git worktree remove --force .worktrees/x   # Windows: a failed rmdir, then removal through the junction
```

**Correct** (one command each):

```sh
node -e "require('fs').unlinkSync('.worktrees/x/node_modules')"   # any platform; refuses a real folder
# or: rm .worktrees/x/node_modules                                 # Linux, macOS: no trailing slash, no -r
# or: MSYS2_ARG_CONV_EXCL='*' cmd /c "rmdir \"$(cygpath -w "$PWD/.worktrees/x/node_modules")\""   # Windows, Git Bash
```

```sh
[ ! -e .worktrees/x/node_modules ] && echo gone
```

```sh
git worktree remove .worktrees/x
```

**How to check:** the `guard-worktree-remove.mjs` hook refuses `git worktree remove` while any `node_modules` or `vendor` in the target is a link.
