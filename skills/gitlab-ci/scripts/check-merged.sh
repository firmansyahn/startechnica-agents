#!/usr/bin/env bash
# check-merged.sh: read-only check of the merged CI configuration (includes, extends, !reference and
# anchors resolved, so the jobs an org template brings are visible) for the gitlab-ci rules the raw
# files can't show: ci-build-needs-checks, ci-cache-write-once, ci-forward-pipeline-variables,
# ci-manual-allow-failure, ci-mr-pipeline-only, ci-tag-before-sha. Prints one finding per line:
# <rule-id>\t<where>: <text>, then a count per rule. scripts/scan.sh covers the raw files.
#
# Usage: bash check-merged.sh [--strict] [--ref <ref>] [merged.yml]
#   merged.yml   a merged configuration saved earlier:
#                glab api "projects/:id/ci/lint?content_ref=<ref>" | jq -r .merged_yaml > merged.yml
#   --ref <ref>  fetch it with glab for a pushed branch, tag or sha (default: HEAD's sha; the project is
#                $CI_PROJECT_ID in a pipeline, else the repo's own, :id)
#   --strict     exit 1 when anything was found (for CI); default exit 0
# Env:
#   BUILD_JOBS='(^|:)build$'                  image build job names (ci-build-needs-checks)
#   RELEASE_JOBS='(^|:)(build|release|stop[a-z-]*)$'   jobs a tag pipeline must reach (ci-tag-before-sha)
#   NEEDS_EMPTY_OK='<regex>'                  build jobs whose needs: [] is deliberate (the merged view
#                                             drops the comment saying so)
#   CACHE_WRITERS='<regex>'                   jobs allowed to write the cache in every pipeline they run
#                                             in (their rules keep them to the integration branch)
#
# Needs jq and yq v4 (github.com/mikefarah/yq); glab for --ref. Linux, macOS, Git Bash on Windows.

set -u
STRICT=0; REF=""; FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --strict) STRICT=1 ;;
    --ref) shift; REF="${1:-}"; [ -n "$REF" ] || { echo "--ref needs a value" >&2; exit 2; } ;;
    -*) echo "unknown argument: $1" >&2; exit 2 ;;
    *) FILE="$1" ;;
  esac
  shift
done
for t in jq yq; do command -v "$t" >/dev/null 2>&1 || { echo "$t is not installed" >&2; exit 2; }; done

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
if [ -z "$FILE" ]; then
  command -v glab >/dev/null 2>&1 || { echo "glab is not installed; pass a merged.yml instead" >&2; exit 2; }
  [ -n "$REF" ] || REF="$(git rev-parse HEAD 2>/dev/null)" || { echo "not inside a git repository; pass --ref" >&2; exit 2; }
  glab api "projects/${CI_PROJECT_ID:-:id}/ci/lint?content_ref=$REF" > "$TMP/lint.json" || { echo "CI lint API call failed" >&2; exit 2; }
  if [ "$(jq -r .valid "$TMP/lint.json")" != true ]; then
    echo "the CI configuration at $REF is invalid:" >&2; jq -r '.errors[]' "$TMP/lint.json" >&2; exit 2
  fi
  jq -r .merged_yaml "$TMP/lint.json" > "$TMP/merged.yml"
  FILE="$TMP/merged.yml"
fi
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 2; }
yq -o=json '.' "$FILE" > "$TMP/merged.json" || { echo "yq could not read $FILE (yq v4 from github.com/mikefarah/yq is needed)" >&2; exit 2; }

OUT="$TMP/out"
jq -r \
  --arg build "${BUILD_JOBS:-(^|:)build\$}" \
  --arg release "${RELEASE_JOBS:-(^|:)(build|release|stop[a-z-]*)\$}" \
  --arg needsok "${NEEDS_EMPTY_OK:-}" \
  --arg writers "${CACHE_WRITERS:-}" '
  def obj: if type == "object" then . else {} end;
  def arr: if type == "array" then . else [] end;
  def ok($re): $re != "" and test($re);
  def val: if type == "object" then (.value // "" | tostring) else tostring end;
  def iff: (.if // "") | tostring;
  # A job: a visible top-level entry with a script, a trigger or run steps.
  def jobs: to_entries | map(select((.key | startswith(".") | not) and (.value | type) == "object"
    and (.value | has("script") or has("trigger") or has("run"))));
  def tagpass: iff | test("\\$\\{?CI_COMMIT_TAG\\}?(?!\\s*(==|=~)\\s*(null|\"\"))");
  . as $root
  | ($root.variables | obj) as $gv
  | ($root.default.cache // null) as $dcache
  | ($root.workflow.rules | arr) as $wf
  | jobs as $jobs
  | (
    # ci-build-needs-checks: a build job that starts with the pipeline
    ($jobs[] | select((.key | test($build)) and .value.needs == [] and (.key | ok($needsok) | not))
      | "ci-build-needs-checks\tjob \(.key): needs: [] starts the build with the pipeline, beside its checks (list the checks; NEEDS_EMPTY_OK if deliberate)"),

    # ci-cache-write-once
    ($jobs[] | .key as $k | .value as $j | ($j.variables | obj) as $jv
      | (if $j | has("cache") then $j.cache else $dcache end) as $c
      | ([$c] | flatten | map(select(type == "object"))) as $caches
      | select($caches | length > 0)
      | ($caches | map((.policy // "pull-push") | tostring)) as $raw
      | ($raw | map(if test("^\\$\\{?[A-Za-z_][A-Za-z0-9_]*\\}?$") then gsub("[${}]"; "") as $n
          | (if $jv | has($n) then ($jv[$n] | val) elif $gv | has($n) then ($gv[$n] | val) else "pull-push" end) else . end)) as $pol
      | ($pol | any(. == "pull-push" or . == "push")) as $writes
      | ($j.parallel != null) as $par
      | (if ($j.parallel | type) == "object" then [($j.parallel.matrix | arr)[] | keys[]] else [] end + ["CI_NODE_INDEX"]) as $shardvars
      | ($raw | map(select(test("^\\$")) | gsub("[${}]"; ""))) as $polvars
      | (if $writes and ($par or ($k | ok($writers) | not)) then
           "ci-cache-write-once\tjob \($k): its cache policy is \($pol | unique | join(",")) in every pipeline it runs in\(if $par then ", from every parallel copy" else "" end) (read it with pull; one job on the integration branch writes it; CACHE_WRITERS if this is that job)"
         else empty end),
        (if $par then ($j.rules | arr | to_entries[]
           | select(.value.variables | obj | to_entries | any(.key as $v | ($polvars | any(. == $v)) and ((.value | val) == "pull-push" or (.value | val) == "push")))
           | select(.value | iff as $i | $shardvars | any(. as $s | $i | contains($s)) | not)
           | "ci-cache-write-once\tjob \($k): rule \(.key + 1) makes every parallel copy write the cache (add a condition on \($shardvars | join(" or ")))")
         else empty end)),

    # ci-manual-allow-failure: a rule makes the job manual and nothing makes it allowed to fail
    ($jobs[] | .key as $k | .value as $j
      | [($j.rules | arr | to_entries[]) | select(.value.when == "manual")
          | select((if .value | has("allow_failure") then .value.allow_failure else $j.allow_failure end) != true) | .key][0]
      | select(. != null)
      | "ci-manual-allow-failure\tjob \($k): rule \(. + 1) makes it manual, and neither the rule nor the job sets allow_failure: true (the pipeline stays blocked)"),

    # ci-tag-before-sha: a zero-BEFORE_SHA never-rule comes before the first rule that lets a tag through
    ($jobs[] | select(.key | test($release)) | .key as $k | (.value.rules | arr) as $r
      | ([$r | to_entries[] | select((.value | iff | test("CI_COMMIT_BEFORE_SHA")) and .value.when == "never" and (.value | iff | test("CI_COMMIT_TAG") | not)) | .key][0]) as $sha
      | ([$r | to_entries[] | select((.value | tagpass) and .value.when != "never") | .key][0]) as $tag
      | select($sha != null and ($tag == null or $sha < $tag))
      | "ci-tag-before-sha\tjob \($k): rule \($sha + 1) drops a zero CI_COMMIT_BEFORE_SHA before \(if $tag == null then "any rule lets a tag through" else "rule \($tag + 1) lets a tag through" end): tag pipelines never run it"),

    # ci-forward-pipeline-variables: workflow:rules set variables, and a trigger job does not forward them
    (if ($wf | any(.variables != null)) then
       ($jobs[] | select(.value | has("trigger"))
         | select((.value.trigger | type) != "object" or .value.trigger.forward.pipeline_variables != true)
         | "ci-forward-pipeline-variables\tjob \(.key): triggers a pipeline without forward: pipeline_variables: true (workflow:rules set variables it would drop)")
     else empty end),

    # ci-mr-pipeline-only: MR pipelines run, and no workflow rule drops the branch pipeline of a branch
    # with an open MR. A workflow that lets branch pipelines through only for tags and the default
    # branch (the MergeRequest-Pipelines workflow template) runs none twice either.
    (if ([$root | .. | strings | select(contains("merge_request_event"))] | length > 0)
        and ($wf | any((iff | contains("CI_OPEN_MERGE_REQUESTS")) and .when == "never") | not)
        and (($wf | length > 0) and ($wf | map(select(.when != "never")) | all(iff | test("merge_request_event|CI_COMMIT_TAG|CI_DEFAULT_BRANCH"))) | not) then
       "ci-mr-pipeline-only\tworkflow: merge_request_event pipelines run, but no workflow rule drops the branch pipeline ($CI_OPEN_MERGE_REQUESTS ... when: never)"
     else empty end)
  )' "$TMP/merged.json" > "$OUT" || { echo "jq failed on $FILE" >&2; exit 2; }

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
