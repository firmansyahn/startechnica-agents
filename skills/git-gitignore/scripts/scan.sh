#!/usr/bin/env bash
# scan.sh: read-only scan of a git checkout for the mechanically detectable rules of git-gitignore
# (rules/ignore-*.md). Prints one finding per line: <rule-id>\t<where>: <text>, then a count per rule.
# Findings are candidates: confirm each against the rule file before reporting it.
#
# Usage: bash scan.sh [--strict]
#   --strict  exit 1 when anything was found (for CI); default exit 0
#
# Covers the whole checkout, skipping other worktrees nested in it (.worktrees/, an agent's own).
# Runs from anywhere inside the repo; POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) echo "unknown argument: $a" >&2; exit 2 ;; esac; done
TOP="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not inside a git repository" >&2; exit 2; }
cd "$TOP" || exit 2

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
OUT="$TMP/out"; : > "$OUT"
emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }

# Other worktrees inside this checkout: their files are not this tree's.
git worktree list --porcelain | sed -n 's/^worktree //p' | while IFS= read -r wt; do
  case "$wt" in "$TOP"/*) printf '%s/\n' "${wt#"$TOP"/}" ;; esac
done > "$TMP/nested"
not_nested() { if [ -s "$TMP/nested" ]; then grep -vF -f "$TMP/nested"; else cat; fi; }

# ignore-untrack-when-ignoring: tracked files that a committed .gitignore matches. Only the repo's own
# .gitignore files count: a pattern in .git/info/exclude or the global excludes file is one clone's
# business, and git keeps tracking the file anyway.
git ls-files -ci --exclude-per-directory=.gitignore | head -50 | sed 's/$/: tracked, but a .gitignore rule matches it (git rm --cached, or narrow the rule)/' \
  | emit ignore-untrack-when-ignoring

# ignore-env-with-values: tracked env files, and env files in the tree that nothing ignores
git ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '\.env\.(example|sample|template)$' \
  | sed 's/$/: env file is tracked/' | emit ignore-env-with-values
find . -name node_modules -prune -o -name .git -prune -o -name .worktrees -prune -o \
  \( -name '.env' -o -name '.env.*' \) -type f -print 2>/dev/null | sed 's#^\./##' \
  | grep -vE '\.env\.(example|sample|template)$' | not_nested | while IFS= read -r f; do
    git ls-files --error-unmatch -- "$f" >/dev/null 2>&1 && continue   # tracked: reported above
    git check-ignore -q -- "$f" || echo "$f: env file that no ignore rule matches"
  done | emit ignore-env-with-values

# ignore-never-shared-files: lockfiles, tool releases and env examples that an ignore rule matches
find . -name node_modules -prune -o -name .git -prune -o -name .worktrees -prune -o \
  \( -name yarn.lock -o -name package-lock.json -o -name pnpm-lock.yaml -o -name go.sum -o -name Cargo.lock \
     -o -name uv.lock -o -name poetry.lock -o -name '.env.example' -o -path '*/.yarn/releases/*' \) -type f -print 2>/dev/null \
  | sed 's#^\./##' | not_nested | while IFS= read -r f; do
    r="$(git check-ignore -v --no-index -- "$f" 2>/dev/null)" && echo "$f: ignored by $r"
  done | emit ignore-never-shared-files

# ignore-reinclude-with-star: a negation under a folder an earlier line excludes as "dir/"
git ls-files '.gitignore' '**/.gitignore' 2>/dev/null | sort -u | while IFS= read -r g; do
  awk -v g="$g" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    /^!/ { p = substr($0, 2); sub(/^\//, "", p)
           for (d in dirs) if (index(p, d) == 1 && length(p) > length(d)) print g ":" NR ": " $0 " never applies: " dirs[d] " excludes the folder (use " d "*)"
           next }
    /\/$/ && !/[*?[]/ { d = $0; sub(/^\//, "", d); dirs[d] = $0 }' "$g"
done | emit ignore-reinclude-with-star

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
