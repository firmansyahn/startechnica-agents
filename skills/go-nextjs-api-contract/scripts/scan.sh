#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the API contract rules of go-nextjs-api-contract that a script can
# find in the handlers (rule files in go-nextjs-api-contract/rules/). Prints one finding per line:
# <rule-id>\t<file>:<line>: <text>, then a count per rule. Findings are candidates: confirm each against its rule
# file before reporting it. The rules the OpenAPI document itself proves are in assets/openapi_rules_test.go.
#
# Usage: bash scan.sh [module-root] [--strict]
#   module-root  the folder with go.mod (default .)
#   --strict     exit 1 when anything was found (for CI); default exit 0
# Environment:
#   ENVELOPE_DIRS  space-separated folders that may write replies themselves: the envelope helper and the
#                  endpoints that answer outside the envelope (OAuth /token, health, metrics, file downloads)
#                  (default: internal/httpx)
#
# Skips vendor/, testdata/, third_party/, node_modules/, .git/ and generated files
# ("// Code generated ... DO NOT EDIT."). Tests (_test.go) are not checked.
# POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f go.mod ] || echo "warning: no go.mod in $ROOT; scanning anyway" >&2
ENVELOPE_DIRS="${ENVELOPE_DIRS:-internal/httpx}"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ALL="$TMP/all"; GEN="$TMP/gen"; LIST="$TMP/list"; TLIST="$TMP/tests"; MAIN="$TMP/main"; LIB="$TMP/lib"; OUT="$TMP/out"
HANDLERS="$TMP/handlers"
: > "$OUT"

find . -type d \( -name vendor -o -name testdata -o -name third_party -o -name node_modules -o -name .git \) -prune \
  -o -type f -name '*.go' -print | sed 's#^\./##' | sort > "$ALL"
[ -s "$ALL" ] || { echo "no .go files under $ROOT" >&2; exit 2; }
xargs -d '\n' grep -lE '^// Code generated .* DO NOT EDIT\.$' < "$ALL" 2>/dev/null | sort > "$GEN"
grep -E '_test\.go$' "$ALL" > "$TLIST"
grep -vE '_test\.go$' "$ALL" | comm -23 - "$GEN" > "$LIST"
xargs -d '\n' grep -lE '^package main$' < "$LIST" 2>/dev/null | sort > "$MAIN"
comm -23 "$LIST" "$MAIN" > "$LIB"

emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }
nocomment() { grep -vE '^[^:]+:[0-9]+:[[:space:]]*//'; }
# g <list> <regex> [grep flags]: matching lines as file:line:text, comment lines dropped
g() { local l="$1" re="$2"; shift 2; [ -s "$l" ] || return 0
  xargs -d '\n' grep -nHE "$@" -- "$re" < "$l" 2>/dev/null | nocomment | cut -c1-220; }
# a <list> [awk options] <awk program>: run awk (POSIX, no gawk extensions) over the files; the program prints file:line: text
a() { local l="$1"; shift; [ -s "$l" ] || return 0; xargs -d '\n' awk "$@" < "$l" 2>/dev/null | cut -c1-220; }
dirs_re() { local re=""; for d in $1; do re="${re:+$re|}^${d%/}/"; done; printf '%s' "${re:-^$}"; }

# The files that write HTTP replies, outside the folders allowed to write them directly.
xargs -d '\n' grep -lE 'http\.ResponseWriter' < "$LIST" 2>/dev/null | grep -vE "$(dirs_re "$ENVELOPE_DIRS")" > "$HANDLERS"

# --- Envelope and errors ----------------------------------------------------------------------
# contract-envelope-one-helper: a reply encoded or written by the handler instead of the envelope helper
g "$HANDLERS" 'json\.NewEncoder\((w|rw|resp|res|writer)\)|(^|[^A-Za-z0-9_.])(w|rw|writer)\.Write\(' \
  | emit contract-envelope-one-helper

# contract-generic-5xx-message: a 5xx reply whose message is built from an error
g "$LIST" 'Fail\([^,]+,[[:space:]]*(5[0-9][0-9]|http\.Status(InternalServerError|NotImplemented|BadGateway|ServiceUnavailable|GatewayTimeout))[[:space:]]*,.*(\.Error\(\)|fmt\.(Sprintf|Errorf)\()' \
  | emit contract-generic-5xx-message
g "$LIST" 'http\.Error\(.*\.Error\(\).*(5[0-9][0-9]|http\.Status(InternalServerError|NotImplemented|BadGateway|ServiceUnavailable|GatewayTimeout))' \
  | emit contract-generic-5xx-message

# --- Resources and values ---------------------------------------------------------------------
# contract-scope-header: the tenant/workspace read from the query, a form or the path instead of the scope header
g "$LIST" '(URL\.Query\(\)\.Get|Form\.Get|FormValue|PostFormValue|PathValue)\("(tenant|workspace)(_id|Id|ID)?"\)' \
  | emit contract-scope-header

# contract-opaque-encoded-ids: an id taken from the path in a file that never checks one
for f in $(xargs -d '\n' grep -lE 'PathValue\("[a-z_]*id"\)' < "$LIST" 2>/dev/null); do
  grep -qE 'valid[A-Z][A-Za-z]*\(|uuid\.Parse|strconv\.Parse(Int|Uint)|ParseID\(' "$f" || grep -nHE 'PathValue\("[a-z_]*id"\)' "$f" \
    | head -1 | cut -c1-200 | sed 's/$/  (no id check in this file)/' | emit contract-opaque-encoded-ids
done

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
