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

# wt-remove-after-merge: worktrees and local branches whose upstream branch is gone from the remote
# (GitLab deletes the source branch on merge, squash merges included). As current as the last
# `git fetch --prune`; a branch pushed without an upstream (-u) isn't seen.
git for-each-ref --format='%(refname) %(upstream:track)' refs/heads | sed -n 's/ \[gone\]$//p' > "$TMP/gone"
if [ -s "$TMP/gone" ]; then
  git worktree list --porcelain | awk '/^worktree / { wt=substr($0, 10) } /^branch / { print substr($0, 8) "\t" wt }' > "$TMP/wtb"
  while IFS= read -r ref; do
    b="${ref#refs/heads/}"
    wt="$(awk -F '\t' -v r="$ref" '$1 == r { print $2; exit }' "$TMP/wtb")"
    if [ -n "$wt" ]; then echo "$wt: worktree on $b, whose upstream is gone (merged?): remove the worktree and the branch"
    else echo "branch $b: its upstream is gone (merged?): delete it (git branch -D $b)"; fi
  done < "$TMP/gone" | emit wt-remove-after-merge
fi

# wt-own-dependencies: dependency links, replace/go.work pointing outside, in every worktree
git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r wt; do
  [ -d "$wt" ] || continue
  find "$wt" -maxdepth 4 \( -name node_modules -o -name vendor \) -prune -type l -print 2>/dev/null | sed 's/$/: link to dependencies outside the worktree/'
  find "$wt" -maxdepth 4 -name .git -prune -o \( -name go.mod -o -name go.work \) -type f -print 2>/dev/null | while IFS= read -r m; do
    grep -nE '=>[[:space:]]*(\.\./|/|[A-Za-z]:)|^[[:space:]]*use[[:space:]]+(\.\./|/)|^[[:space:]]+(\.\./|/)' "$m" \
      | grep -vE '=>[[:space:]]*\./' | sed "s#^#$m:#; s/\$/  (path outside the module: check it stays inside the worktree)/"
  done
done | sort -u | emit wt-own-dependencies   # sort -u: a worktree inside .worktrees/ is also seen from the main checkout

# wt-disjoint-files: files changed in two worktrees since their commits last had a common ancestor.
# A worktree's own changes are its non-merge commits since that ancestor that aren't on the default
# branch yet (so commits it merged in from the base don't count), plus uncommitted and untracked
# files. A stack's child shares its parent's commits, so it doesn't report the parent's files.
git worktree list --porcelain | sed -n 's/^worktree //p' > "$TMP/wts"
DEFAULT_BASE="$(git rev-parse -q --verify origin/HEAD 2>/dev/null)"
own_changes() { # <worktree> <merge-base>
  if [ -n "$DEFAULT_BASE" ]; then git -C "$1" log --no-merges --name-only --format= "$2..HEAD" --not "$DEFAULT_BASE" 2>/dev/null </dev/null
  else git -C "$1" log --no-merges --name-only --format= "$2..HEAD" 2>/dev/null </dev/null; fi
  git -C "$1" diff --name-only HEAD 2>/dev/null </dev/null
  git -C "$1" ls-files --others --exclude-standard 2>/dev/null </dev/null
}
i=0
while IFS= read -r a; do
  i=$((i + 1)); j=0
  while IFS= read -r b; do
    j=$((j + 1))
    [ "$j" -le "$i" ] && continue
    [ -d "$a" ] && [ -d "$b" ] || continue
    ha="$(git -C "$a" rev-parse -q --verify HEAD 2>/dev/null </dev/null)" || continue
    hb="$(git -C "$b" rev-parse -q --verify HEAD 2>/dev/null </dev/null)" || continue
    mb="$(git merge-base "$ha" "$hb" 2>/dev/null </dev/null)" || continue
    own_changes "$a" "$mb" | sed '/^$/d' | sort -u > "$TMP/fa"
    own_changes "$b" "$mb" | sed '/^$/d' | sort -u > "$TMP/fb"
    comm -12 "$TMP/fa" "$TMP/fb" | sed "s#^#$a and $b: #; s#\$# is changed in both worktrees#"
  done < "$TMP/wts"
done < "$TMP/wts" | emit wt-disjoint-files

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
