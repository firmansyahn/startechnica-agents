#!/usr/bin/env bash
# scan.sh: read-only scan of a repo's GitLab CI files for the mechanically detectable rules of
# gitlab-ci (rules/ci-*.md). Prints one finding per line: <rule-id>\t<where>: <text>, then a count
# per rule. Findings are candidates: confirm each against the rule file before reporting it.
# Also run `glab ci lint` (and `--dry-run --include-jobs` for rule changes); this scan doesn't parse YAML.
#
# Usage: bash scan.sh [--strict]
#   --strict  exit 1 when anything was found (for CI); default exit 0
# Env:
#   PER_APP_VARS="A|B"  names that are per app and must not be set in the root file
#                       (default APP_IMAGE_REPOSITORY|APP_REGISTRY_IMAGE|APP_NAME; ci-per-app-vars-in-child)
#
# The raw files don't show what an included template sets. scripts/check-merged.sh checks the merged
# configuration (templates included) for the rules that need it.
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

  # Job blocks below: a top-level key with nothing after the colon starts one; any other top-level
  # line ends it. A job-level key is indented like the block's first line (rules: and cache: items
  # are deeper).

  # ci-build-needs-checks: build jobs with no needs: of their own (an org build template's needs: []
  # then starts them beside the checks), or with needs: [] and no comment above it saying why
  while IFS= read -r f; do
    awk -v f="$f" '
      function done_job() {
        if (job == "build" || job ~ /:build$/) {
          if (!needs) print f ":" jline ": " job " has no needs: of its own (a build template sets needs: [], so it starts beside the checks)"
          else if (empty && !why) print f ":" nline ": " job " has needs: [] with no comment saying why it starts with the pipeline"
        }
      }
      /^[A-Za-z.<"$][^ ]*:[[:space:]]*$/ { done_job(); job=$1; sub(/:$/, "", job); gsub(/"/, "", job); jline=NR; ind=-1; needs=0; empty=0; why=0; prev=""; next }
      /^[^[:space:]#]/ { done_job(); job=""; next }
      job != "" && /^[[:space:]]+[^[:space:]#]/ {
        match($0, /^[[:space:]]+/); if (ind < 0) ind = RLENGTH
        if (RLENGTH == ind && /^[[:space:]]+needs:/) {
          needs=1
          if (/needs:[[:space:]]*\[[[:space:]]*\]/) { empty=1; nline=NR; if (prev ~ /^[[:space:]]*#/) why=1 }
        }
      }
      { prev=$0 }
      END { done_job() }' "$f"
  done < "$TMP/ci" | emit ci-build-needs-checks

  # ci-cache-write-once: a cache with no policy (defaults to pull-push: every run uploads it), or one
  # written in every pipeline (policy: pull-push); a policy: $VAR is resolved by check-merged.sh
  while IFS= read -r f; do
    awk -v f="$f" '
      function done_job() {
        if (cache && !policy) print f ":" cline ": " job " has a cache with no policy: (pull-push by default: every run uploads it)"
        if (cache && push) print f ":" pline ": " job " writes the cache in every pipeline it runs in (policy: " pval ")"
      }
      /^[A-Za-z.<"$][^ ]*:[[:space:]]*$/ { done_job(); job=$1; sub(/:$/, "", job); gsub(/"/, "", job); ind=-1; cache=0; policy=0; push=0; next }
      /^[^[:space:]#]/ { done_job(); job=""; next }
      job != "" && /^[[:space:]]+[^[:space:]#]/ {
        match($0, /^[[:space:]]+/); if (ind < 0) ind = RLENGTH
        if (RLENGTH == ind && /^[[:space:]]+cache:/) { cache=1; cline=NR }
        if (/[[:space:]{,]policy:/) {
          policy=1
          if (/policy:[[:space:]]*["\047]?(pull-push|push)([^-a-z]|$)/) { push=1; pline=NR; pval=$0; sub(/.*policy:[[:space:]]*["\047]?/, "", pval); sub(/[^-a-z].*/, "", pval) }
        }
      }
      END { done_job() }' "$f"
  done < "$TMP/ci" | emit ci-cache-write-once

  # ci-forward-pipeline-variables: when workflow:rules set variables, every trigger job forwards
  # pipeline variables (trigger: forward: pipeline_variables: true)
  WF_VARS="$(while IFS= read -r f; do
    awk '/^workflow:/ { w=1; next } /^[^[:space:]#]/ { w=0 } w && /^[[:space:]]+(-[[:space:]]+)?variables:/ { print "yes"; exit }' "$f"
  done < "$TMP/ci" | head -1)"
  if [ "$WF_VARS" = yes ]; then
    while IFS= read -r f; do
      awk -v f="$f" '
        function done_job() { if (trig && !fwd) print f ":" tline ": " job " triggers a pipeline without forward: pipeline_variables: true (workflow:rules set variables it would drop)" }
        /^[A-Za-z.<"$][^ ]*:[[:space:]]*$/ { done_job(); job=$1; sub(/:$/, "", job); gsub(/"/, "", job); ind=-1; trig=0; fwd=0; next }
        /^[^[:space:]#]/ { done_job(); job=""; next }
        job != "" && job !~ /^\./ && /^[[:space:]]+[^[:space:]#]/ {
          match($0, /^[[:space:]]+/); if (ind < 0) ind = RLENGTH
          if (RLENGTH == ind && /^[[:space:]]+trigger:/) { trig=1; tline=NR }
          if (/pipeline_variables:[[:space:]]*true/) fwd=1
        }
        END { done_job() }' "$f"
    done < "$TMP/ci" | emit ci-forward-pipeline-variables
  fi

  # ci-mr-pipeline-only: MR pipelines are used, but no workflow rule drops the branch pipeline of a
  # branch with an open MR ($CI_OPEN_MERGE_REQUESTS ... when: never, or GitLab's MergeRequest-Pipelines
  # workflow template)
  MR_USED=0; WF_OK=0
  while IFS= read -r f; do
    grep -qE '^[^#]*merge_request_event' "$f" && MR_USED=1
    [ "$(awk '
      /^[[:space:]]*#/ { next }
      /Workflows\/MergeRequest-Pipelines\.gitlab-ci\.yml/ { ok=1 }
      /^workflow:/ { w=1; next }
      /^[^[:space:]]/ { w=0 }
      w && /CI_OPEN_MERGE_REQUESTS/ { pending=1; if (/when:[[:space:]]*never/) ok=1; next }
      w && pending && /^[[:space:]]*-[[:space:]]/ { pending=0 }
      w && pending && /when:[[:space:]]*never/ { ok=1 }
      END { print ok ? "ok" : "" }' "$f")" = ok ] && WF_OK=1
  done < "$TMP/ci"
  if [ "$MR_USED" = 1 ] && [ "$WF_OK" = 0 ]; then
    root="$(grep -xE '\.gitlab-ci\.yml' "$TMP/ci" || head -1 "$TMP/ci")"
    echo "$root: merge_request_event pipelines run, but no workflow rule drops the branch pipeline (\$CI_OPEN_MERGE_REQUESTS ... when: never)" | emit ci-mr-pipeline-only
  fi

  # ci-per-app-vars-in-child: per-app names in the root file's variables: or workflow:rules variables,
  # when the root includes child files (a single-app repo whose root is the app is skipped)
  if [ -f .gitlab-ci.yml ] && { grep -qE '^[^#]*local:' .gitlab-ci.yml || [ "$(wc -l < "$TMP/ci")" -gt 1 ]; }; then
    awk -v f=.gitlab-ci.yml -v keys="${PER_APP_VARS:-APP_IMAGE_REPOSITORY|APP_REGISTRY_IMAGE|APP_NAME}" '
      /^variables:/ { v=1; next }
      /^workflow:/ { v=1; next }
      /^[^[:space:]#]/ { v=0 }
      v && !/^[[:space:]]*#/ && $0 ~ ("(^[[:space:]]+|[{,][[:space:]]*)(" keys ")[[:space:]]*:") {
        line=$0; gsub(/^[[:space:]]+/, "", line); print f ":" NR ": " line "  (per-app: set it in the app child file)" }' .gitlab-ci.yml \
      | cut -c1-200 | emit ci-per-app-vars-in-child
  fi

  # ci-pin-images: images pulled straight from Docker Hub instead of through the mirror variable
  # ($IMAGE_MIRROR/<image>), and a Playwright image whose version isn't the @playwright/test in a
  # package.json
  while IFS= read -r f; do
    awk -v f="$f" '
      /^[[:space:]]*#/ { next }
      match($0, /(^|[[:space:]{,-])(image|[A-Z0-9_]+_IMAGE):[[:space:]]+["\047]?[^[:space:]"\047#]+/) {
        v = substr($0, RSTART, RLENGTH); sub(/^[^:]*:[[:space:]]*["\047]?/, "", v)
        if (v ~ /^\$/) next
        n = split(v, p, "/")
        if (n == 1 || p[1] ~ /^(docker\.io|index\.docker\.io|registry-1\.docker\.io)$/ || (p[1] !~ /[.:]/ && p[1] != "localhost"))
          print f ":" NR ": " v " is pulled from Docker Hub directly (pull it through the mirror: $IMAGE_MIRROR/" v ")"
      }' "$f"
  done < "$TMP/ci" | emit ci-pin-images
  PW="$(git ls-files 'package.json' '**/package.json' 2>/dev/null | while IFS= read -r p; do
    grep -oE '"@playwright/test"[[:space:]]*:[[:space:]]*"[^"]*"' "$p" | sed -E 's/.*"[~^=v]*([0-9][^"]*)"$/\1/'
  done | sort -u | tr '\n' ' ')"
  if [ -n "$PW" ]; then
    PW="${PW% }"
    while IFS= read -r f; do
      grep -nE 'mcr\.microsoft\.com/playwright:v[0-9]+\.[0-9]+\.[0-9]+' "$f" | grep -vE '^[0-9]+:[[:space:]]*#' | while IFS= read -r l; do
        v="$(printf '%s\n' "$l" | sed -E 's/.*playwright:v([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
        case " $PW " in *" $v "*) ;; *) echo "$f:${l%%:*}: playwright image v$v, but package.json has @playwright/test $PW" ;; esac
      done
    done < "$TMP/ci" | emit ci-pin-images
  fi
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
