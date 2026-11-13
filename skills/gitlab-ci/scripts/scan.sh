#!/usr/bin/env bash
# scan.sh: read-only scan of a repo's GitLab CI files for the mechanically detectable rules of
# gitlab-ci (rules/ci-*.md). Prints one finding per line: <rule-id>\t<where>: <text>, then a count
# per rule. Findings are candidates: confirm each against the rule file before reporting it.
# Also run `glab ci lint` (and `--dry-run --include-jobs` for rule changes); this scan doesn't parse YAML.
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

git ls-files '*.gitlab-ci.yml' '.gitlab-ci.yml' '**/.gitlab-ci.yml' 2>/dev/null | sort -u > "$TMP/ci"
if [ -s "$TMP/ci" ]; then
  # ci-pin-images: floating or archived images in CI files
  while IFS= read -r f; do
    grep -nHE '(image:|_IMAGE:)[[:space:]]*[^[:space:]#]+(:latest\b|:debug\b)|gcr\.io/kaniko-project|(image:|_IMAGE:)[[:space:]]*[a-z0-9./_-]+[[:space:]]*$' "$f" \
      | grep -vE '^[^:]+:[0-9]+:[[:space:]]*#' | grep -vE '\$\[\[|\$\{?[A-Z_]+\}?[[:space:]]*$' | cut -c1-200
  done < "$TMP/ci" | emit ci-pin-images
  # ci-tests-block-merge: test jobs that are manual or allowed to fail
  while IFS= read -r f; do
    awk -v f="$f" '
      /^[A-Za-z.][^ ]*:[[:space:]]*$/ { job=$1; sub(/:$/, "", job) }
      job ~ /test|spec|e2e|playwright/ && job !~ /^\./ && /when:[[:space:]]*manual|allow_failure:[[:space:]]*true/ {
        gsub(/^[[:space:]]+/, ""); print f ":" NR ": " job " has " $0 }' "$f"
  done < "$TMP/ci" | emit ci-tests-block-merge
  # ci-manual-allow-failure: jobs made manual in rules with no allow_failure of their own (an
  # included template may set it: confirm, and restate it in the job so it holds either way)
  while IFS= read -r f; do
    awk -v f="$f" '
      function done_job() { if (job != "" && manual && !af) print f ":" mline ": " job " is manual with no allow_failure" }
      /^[A-Za-z.<"$][^ ]*:[[:space:]]*$/ { done_job(); job=$1; sub(/:$/, "", job); manual=0; af=0; next }
      /^[^[:space:]#]/ { done_job(); job=""; next }
      job != "" && /when:[[:space:]]*manual/ && !manual { manual=1; mline=NR }
      job != "" && /^[[:space:]]+allow_failure:/ { af=1 }
      END { done_job() }' "$f"
  done < "$TMP/ci" | emit ci-manual-allow-failure
fi

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
