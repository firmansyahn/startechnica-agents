# Patterns, other ignore files, and debugging

Source: [gitignore(5)](https://git-scm.com/docs/gitignore). Templates per language: [github/gitignore](https://github.com/github/gitignore) (CC0); copy only the lines for tools the repo uses.

## Where git reads ignore rules, in order

1. A `.gitignore` in the file's folder or any parent up to the repo root; a deeper file wins over a higher one.
2. `.git/info/exclude`: this clone only, never committed.
3. The global excludes file: `core.excludesFile`, else `$XDG_CONFIG_HOME/git/ignore`, else `~/.config/git/ignore`.

Within one file the last matching line wins. Ignoring only applies to untracked files.

## Pattern syntax

| Pattern | Matches |
|---|---|
| `name` | A file or folder called `name` at any depth |
| `name/` | A folder called `name` at any depth |
| `/name` | `name` in the folder of this `.gitignore` only |
| `dir/name` | Relative to this `.gitignore` (a slash anywhere but the end anchors it) |
| `*.log` | Any `.log` file at any depth (`*` doesn't cross `/`) |
| `**/name` | `name` at any depth (the same as `name`, written out) |
| `dir/**` | Everything inside `dir` |
| `a/**/b` | `b` under `a` at any depth, `a/b` included |
| `!pattern` | Re-includes what an earlier line excluded, unless a parent folder is excluded |
| `\#file`, `\!file` | A name that starts with `#` or `!` |
| `# text` | A comment; blank lines separate groups |

Trailing spaces are ignored unless escaped (`\ `). A pattern is matched against the path relative to the `.gitignore` that holds it.

## Case sensitivity

On Windows and macOS `core.ignorecase` is usually `true`, so `Build/` and `build/` match the same folder there but not on Linux (CI). Write patterns in the case the tools produce.

## Other ignore files

| File | Read by | Differences from `.gitignore` |
|---|---|---|
| `.dockerignore` | `docker build` (the build context) | Relative to the context root; a bare name matches only at the root (`**/node_modules` for any depth); a leading `/` is dropped; the last matching line wins; `!` exceptions work |
| `.npmignore`, `files` in `package.json` | `npm publish` | Replaces `.gitignore` for the package when present |
| `.prettierignore`, `.eslintignore`, linters' `ignores` | Formatters, linters | Mostly gitignore syntax; check each tool |
| A code indexer's ignore file | The indexer | Usually gitignore syntax; add worktree and capture folders (`git-worktree`) |
| `.gitattributes` | git | Not an ignore file: line endings, binary and diff settings (`git-commit`) |

## Debugging

```sh
git check-ignore -v <path>              # prints <file>:<line>:<pattern> <path> for the rule that ignores it
git check-ignore -v --no-index <path>   # also for a tracked path (otherwise tracked paths report nothing)
git ls-files -ci --exclude-standard     # tracked files that the rules match
git status --ignored --short            # ignored files right now ("!!" lines)
git clean -ndX                          # ignored files a clean would delete; -n is the dry run
```

`git check-ignore` exits 0 when the path is ignored and 1 when it isn't, so it works in scripts (`git check-ignore -q .env || echo ".env is not ignored"`).
