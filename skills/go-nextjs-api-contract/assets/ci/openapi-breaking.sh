#!/usr/bin/env bash
# openapi-breaking.sh: CI step for go-nextjs-api-contract contract-doc-deprecate-before-removing and
# contract-doc-stable-operation-ids. Compares every <api-dir>/<surface>.openapi.json with the target branch's copy
# through oasdiff and fails on:
#   - an operation, path, parameter or request property removed without deprecated: true in the base, a response
#     property removed (oasdiff can't see deprecation on an optional one, so every removal fails), a type change
#     and every other change oasdiff rates breaking (error) or possibly breaking (warning);
#   - a changed operationId (api-operation-id-removed, raised to an error here);
#   - a surface whose document was deleted.
# A break the team accepts (a field deprecated a release ago, a first-party console shipping with its backend)
# gets a line in the ignore file: the method and path, then the message as oasdiff prints it, e.g.
#   GET /items removed the optional property `display_name` from the response with the `200` status
# Review checks each new line names something that was deprecated in an earlier release.
#
# Usage: bash openapi-breaking.sh <base-ref> [api-dir]
#   base-ref  the target branch, fetched (origin/main; on GitLab origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME)
#   api-dir   the folder of the documents in the repository (default api)
# Environment:
#   OASDIFF         the oasdiff binary (default oasdiff); pin its version: go install github.com/oasdiff/oasdiff@<version>
#   OASDIFF_IGNORE  the accepted-breaks file (default <api-dir>/breaking-ignore.txt, used when it exists)
# Read-only; exits 1 on a finding, 2 on a usage error. POSIX tools, git and oasdiff (Linux, macOS, Git Bash).

set -u
BASE="${1:-}"; DIR="${2:-api}"
[ -n "$BASE" ] || { echo "usage: bash openapi-breaking.sh <base-ref> [api-dir]" >&2; exit 2; }
OASDIFF="${OASDIFF:-oasdiff}"
IGNORE="${OASDIFF_IGNORE:-$DIR/breaking-ignore.txt}"
command -v "$OASDIFF" >/dev/null 2>&1 || { echo "oasdiff not found (set OASDIFF)" >&2; exit 2; }
git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null || { echo "unknown ref $BASE: fetch the target branch first" >&2; exit 2; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# oasdiff rates these as info; for this team they break a client.
cat > "$TMP/levels.txt" <<'EOF'
response-optional-property-removed err
api-operation-id-removed err
EOF
set -- --fail-on WARN --severity-levels "$TMP/levels.txt"
[ -f "$IGNORE" ] && set -- "$@" --err-ignore "$IGNORE" --warn-ignore "$IGNORE"

status=0
for doc in $(git ls-tree -r --name-only "$BASE" -- "$DIR" | grep -E '\.openapi\.json$'); do
  if [ ! -f "$doc" ]; then
    echo "$doc: deleted; every client of this surface breaks (contract-doc-deprecate-before-removing)"
    status=1
    continue
  fi
  git show "$BASE:$doc" > "$TMP/base.json"
  echo "--- $doc against $BASE"
  "$OASDIFF" breaking "$TMP/base.json" "$doc" "$@" || status=1
done
for doc in $(git ls-files -- "$DIR" | grep -E '\.openapi\.json$'); do
  git cat-file -e "$BASE:$doc" 2>/dev/null || echo "--- $doc: new surface, nothing to compare"
done
[ "$status" -eq 0 ] || echo "Deprecate first (deprecated: true naming the replacement), or add the accepted break to $IGNORE (rules contract-doc-deprecate-before-removing, contract-doc-stable-operation-ids)"
exit "$status"
