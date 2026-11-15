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
#   REPO_PUBLIC=1            the repo is public (or might be): check IPv4 addresses, emails and
#                            INTERNAL_PATTERNS in commit messages, added lines, the branch name and the
#                            MR's title, description and notes (mr-no-internal-details-public)
#   INTERNAL_PATTERNS="a|b"  extended regex (case-insensitive) of the project's internal names
#   MR=<iid>                 the MR whose text to check (default: the current branch's, through glab
#                            and jq; MR=0 skips it)
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
  # emails other than noreply, git@<host>: and the reserved example domains
  EMAIL='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  email_hits() {
    grep -oE "$EMAIL" | grep -viE 'noreply|^git@|@([A-Za-z0-9-]+\.)*(example\.(com|org|net)|[A-Za-z0-9-]+\.(example|test|invalid|localhost))$' | sort -u | sed 's/^/email /'
  }
  all_hits() { tee "$TMP/in" > /dev/null; ip_hits < "$TMP/in"; name_hits < "$TMP/in"; email_hits < "$TMP/in"; }
  git log --format='%h %B' "$RANGE" | all_hits | sort -u | head -50 | cut -c1-200 | sed 's/^/message: /' | emit mr-no-internal-details-public
  git diff -U0 "$RANGE" | grep -E '^\+[^+]' | all_hits | sort -u | head -100 | cut -c1-200 | sed 's/^/added line: /' | emit mr-no-internal-details-public
  git rev-parse --abbrev-ref HEAD | all_hits | sed 's/^/branch name: /' | emit mr-no-internal-details-public
  # The MR's own text: title, description, source branch and notes (MR=<iid>, default the current
  # branch's MR; MR=0 skips it). Needs glab and jq; skipped quietly without them or without an MR.
  if [ "${MR:-}" != 0 ] && command -v glab >/dev/null 2>&1 && command -v jq >/dev/null 2>&1 \
    && glab mr view ${MR:+"$MR"} -F json > "$TMP/mr.json" 2>/dev/null && [ -s "$TMP/mr.json" ]; then
    iid="$(jq -r '.iid // empty' "$TMP/mr.json")"
    jq -r '.title, .description // "", .source_branch' "$TMP/mr.json" | all_hits | sort -u | head -50 | cut -c1-200 \
      | sed "s/^/MR !$iid text: /" | emit mr-no-internal-details-public
    [ -n "$iid" ] && glab api "projects/:id/merge_requests/$iid/notes?per_page=100" 2>/dev/null \
      | jq -r '.[] | select(.system | not) | .body' 2>/dev/null | all_hits | sort -u | head -50 | cut -c1-200 \
      | sed "s/^/MR !$iid note: /" | emit mr-no-internal-details-public
  fi
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
