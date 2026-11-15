#!/usr/bin/env bash
# scan.sh: read-only scan of a git repo for the mechanically detectable rules of git-commit
# (rules/commit-*.md). Prints one finding per line: <rule-id>\t<where>: <text>, then a count per rule.
# Findings are candidates: confirm each against the rule file before reporting it.
#
# Usage: bash scan.sh [base-ref] [--strict]
#   base-ref  commits in base-ref..HEAD are checked (default: the upstream of the current branch,
#             else origin/HEAD); the line-ending checks cover the whole checkout
#   --strict  exit 1 when anything was found (for CI); default exit 0
# Env:
#   REPO_PUBLIC=1  the repo is public (or might be): also check author/committer emails (commit-identity-public)
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

# --- commits in the range ----------------------------------------------------------------------
TYPES='feat|fix|build|chore|ci|docs|perf|refactor|revert|style|test'
# commit-conventional: subjects that aren't <type>(<scope>)!: <description>, merges excepted
git log --no-merges --format='%h %s' "$RANGE" \
  | grep -vE "^[0-9a-f]+ ($TYPES)(\([^)]+\))?!?: [^ ]" | sed 's/^/commit /' | emit commit-conventional

# commit-ci-skip-without-code: [ci skip] / [skip ci] commits that touch anything but docs and agent files
git log --no-merges --format='%h' -i -E --grep='\[(ci skip|skip ci)\]' "$RANGE" | while read -r h; do
  git show --name-only --format= "$h" \
    | grep -vE '(^|/)(docs?|\.agents|\.claude|\.github/prompts)/|\.(md|txt)$|^(README|CHANGELOG|LICENSE)' \
    | head -3 | sed "s/^/commit $h: [ci skip] but changes /"
done | emit commit-ci-skip-without-code

# commit-stage-by-name: secret or local files added in the range
git diff --name-only --diff-filter=A "$RANGE" \
  | grep -E '(^|/)\.env($|\.)|\.local\.json$|\.(pem|key|p12|pfx|jks)$|(^|/)id_(rsa|ed25519)|(^|/)credentials(\.json)?$' \
  | grep -vE '\.env\.(example|sample|template)$' | sed 's/^/added /' | emit commit-stage-by-name

# commit-identity-public: personal or company emails in a public repo
if [ "${REPO_PUBLIC:-0}" = 1 ]; then
  git log --format='%h author=%ae committer=%ce' "$RANGE" | grep -vE 'author=[^ ]*noreply[^ ]* committer=[^ ]*noreply' \
    | sed 's/^/commit /' | emit commit-identity-public
fi

# commit-no-backslash-escaped-backticks: backslash-backtick in a commit subject or body (PowerShell quoting)
git log --no-merges --format='%h%x09%s%x09%b' "$RANGE" | grep -F '\`' | cut -f1-2 \
  | sed 's/\t/: /' | sed 's/^/commit /' | emit commit-no-backslash-escaped-backticks

# --- files in the checkout ---------------------------------------------------------------------
# commit-lf-endings
grep -qE '^\*[[:space:]].*eol=lf' .gitattributes 2>/dev/null || echo ".gitattributes: no '* text=auto eol=lf' line" | emit commit-lf-endings
git ls-files --eol | awk '$1 ~ /^i\/(crlf|mixed)$/ { print $NF ": committed with " $1 }' | head -50 | emit commit-lf-endings

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
