#!/usr/bin/env bash
# scan.sh: read-only scan of a git repo and all its worktrees for the mechanically detectable rules
# of git-worktree (rules/wt-*.md). Prints one finding per line: <rule-id>\t<where>: <text>, then a
# count per rule. Findings are candidates: confirm each against the rule file before reporting it.
#
# Usage: bash scan.sh [--strict]
#   --strict  exit 1 when anything was found (for CI); default exit 0
#
# Runs from anywhere inside the repo; POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) echo "unknown argument: $a" >&2; exit 2 ;; esac; done
TOP="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not inside a git repository" >&2; exit 2; }
cd "$TOP" || exit 2

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
OUT="$TMP/out"; : > "$OUT"
emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }

# wt-own-dependencies: the .worktrees/ folder is ignored by git, and by Docker when the repo has a
# Dockerfile context here
if [ -d .worktrees ] || git worktree list --porcelain | grep -q '^worktree .*/\.worktrees/'; then
  git check-ignore -q .worktrees/ || echo ".gitignore: .worktrees/ is not ignored" | emit wt-own-dependencies
  [ -f .dockerignore ] && ! grep -qE '^/?\.worktrees/?$' .dockerignore && echo ".dockerignore: no .worktrees entry" | emit wt-own-dependencies
fi

# wt-remove-after-merge: worktrees whose folder is gone
git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r wt; do
  [ -d "$wt" ] || echo "$wt: worktree folder is gone (git worktree prune)"
done | emit wt-remove-after-merge

# wt-own-dependencies: dependency links, replace/go.work pointing outside, in every worktree
git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r wt; do
  [ -d "$wt" ] || continue
  find "$wt" -maxdepth 4 \( -name node_modules -o -name vendor \) -prune -type l -print 2>/dev/null | sed 's/$/: link to dependencies outside the worktree/'
  find "$wt" -maxdepth 4 -name .git -prune -o \( -name go.mod -o -name go.work \) -type f -print 2>/dev/null | while IFS= read -r m; do
    grep -nE '=>[[:space:]]*(\.\./|/|[A-Za-z]:)|^[[:space:]]*use[[:space:]]+(\.\./|/)|^[[:space:]]+(\.\./|/)' "$m" \
      | grep -vE '=>[[:space:]]*\./' | sed "s#^#$m:#; s/\$/  (path outside the module: check it stays inside the worktree)/"
  done
done | sort -u | emit wt-own-dependencies   # sort -u: a worktree inside .worktrees/ is also seen from the main checkout

# --- report --------------------------------------------------------------------------------------
if [ -s "$OUT" ]; then
  sort -s -t "$(printf '\t')" -k1,1 "$OUT"
  echo
  echo "counts:"
  cut -f1 "$OUT" | sort | uniq -c | sort -rn
  [ "$STRICT" = 1 ] && exit 1
else
  echo "no findings"
fi
exit 0
