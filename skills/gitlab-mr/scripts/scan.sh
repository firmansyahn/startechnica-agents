#!/usr/bin/env bash
# scan.sh: read-only scan of a branch for the mechanically detectable rules of gitlab-mr
# (rules/mr-*.md). Prints one finding per line: <rule-id>\t<where>: <text>, then a count per rule.
# Findings are candidates: confirm each against the rule file before reporting it. The MR itself
# (target, title, description, pipeline for its sha) is checked by reading it with glab.
#
# Usage: bash scan.sh [base-ref] [--strict]
#   base-ref  commits in base-ref..HEAD are checked (default: the upstream of the current branch,
#             else origin/HEAD); the token check covers the whole checkout
#   --strict  exit 1 when anything was found (for CI); default exit 0
# Env:
#   REPO_PUBLIC=1            the repo is public (or might be): check IPv4 addresses and INTERNAL_PATTERNS
#                            in commit messages and added lines (mr-no-internal-details-public)
#   INTERNAL_PATTERNS="a|b"  extended regex (case-insensitive) of the project's internal names
#
# Runs from anywhere inside the repo; POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
BASE=""; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) BASE="$a" ;; esac; done
TOP="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "not inside a git repository" >&2; exit 2; }
cd "$TOP" || exit 2
if [ -z "$BASE" ]; then
  BASE="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null)"
  [ -n "$BASE" ] && [ "$(git rev-parse "$BASE")" = "$(git rev-parse HEAD)" ] && BASE=""
  [ -n "$BASE" ] || BASE="$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null)"
fi
git rev-parse -q --verify "$BASE^{commit}" >/dev/null 2>&1 || { echo "base ref '$BASE' not found; pass one" >&2; exit 2; }
RANGE="$BASE..HEAD"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
OUT="$TMP/out"; : > "$OUT"
emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }

# mr-no-internal-details-public (public repos only): the project's internal names anywhere, and IPv4
# addresses outside the documentation ranges (RFC 5737), loopback and 0.0.0.0, in messages and added lines
if [ "${REPO_PUBLIC:-0}" = 1 ]; then
  IP='(^|[^0-9.])((25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])([^0-9.]|$)'
  OK_IP='(^|[^0-9.])(0\.0\.0\.0|127\.0\.0\.1|192\.0\.2\.[0-9]+|198\.51\.100\.[0-9]+|203\.0\.113\.[0-9]+|255\.255\.255\.[0-9]+)([^0-9.]|$)'
  ip_hits() { grep -E "$IP" | grep -vE "$OK_IP"; }
  name_hits() { [ -n "${INTERNAL_PATTERNS:-}" ] && grep -iE "$INTERNAL_PATTERNS"; }
  git log --format='%h %B' "$RANGE" > "$TMP/msgs"
  { ip_hits < "$TMP/msgs"; name_hits < "$TMP/msgs"; } | sort -u | head -50 | cut -c1-200 | sed 's/^/message: /' | emit mr-no-internal-details-public
  git diff -U0 "$RANGE" | grep -E '^\+[^+]' > "$TMP/added"
  { ip_hits < "$TMP/added"; name_hits < "$TMP/added"; } | sort -u | head -100 | cut -c1-200 | sed 's/^/added line: /' | emit mr-no-internal-details-public
fi

# mr-glab-for-gitlab: tokens pasted into tracked files
git grep -nIE 'PRIVATE[-]TOKEN:|glpat-[A-Za-z0-9_-]{10,}|https://oauth2[:][^@ ]+@' -- . ':!*.lock' 2>/dev/null \
  | cut -c1-200 | emit mr-glab-for-gitlab

# --- report --------------------------------------------------------------------------------------
if [ -s "$OUT" ]; then
  sort -s -t "$(printf '\t')" -k1,1 "$OUT"
  echo
  echo "counts (range $RANGE):"
  cut -f1 "$OUT" | sort | uniq -c | sort -rn
  [ "$STRICT" = 1 ] && exit 1
else
  echo "no findings (range $RANGE)"
fi
exit 0
