#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the layout rules of go-project-layout that a script can find
# (rule files in go-project-layout/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
# count per rule. Findings are candidates: confirm each against its rule file before reporting it.
# It complements go vet / golangci-lint, which find several of these exactly; run those too.
#
# Usage: bash scan.sh [module-root] [--strict]
#   module-root  the folder with go.mod (default .)
#   --strict     exit 1 when anything was found (for CI); default exit 0
#
# Skips vendor/, testdata/, third_party/, node_modules/, .git/ and generated files
# ("// Code generated ... DO NOT EDIT."). Tests (_test.go) are not checked.
# POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f go.mod ] || echo "warning: no go.mod in $ROOT; scanning anyway" >&2

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ALL="$TMP/all"; GEN="$TMP/gen"; LIST="$TMP/list"; TLIST="$TMP/tests"; MAIN="$TMP/main"; LIB="$TMP/lib"; OUT="$TMP/out"
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

LOGRE='(^|[^A-Za-z0-9_])(log|logger|lg|l|slog|zap\.L\(\)|zap\.S\(\))[A-Za-z]*\.(Error|Warn|Info|Debug)[A-Za-z]*\('

# --- layering ---------------------------------------------------------------------------------
# layer-inject-dependencies (mutable package-level state; non-empty literal tables are left alone)
a "$LIB" '
  FNR==1 { invar=0 }
  /^var \($/ { invar=1; next }
  invar && /^\)/ { invar=0; next }
  {
    s=""
    if ($0 ~ /^var [A-Za-z][A-Za-z0-9_]*/) { s=$0; sub(/^var /,"",s) } else if (invar && $0 ~ /^\t[A-Za-z][A-Za-z0-9_]*/) { s=$0; sub(/^\t/,"",s) }
    if (s == "" || s ~ /^(_|[Ee]rr)/) next
    if (s ~ /=[[:space:]]*(make\(|new\(|&[A-Za-z_.]+\{\}|sync\.|(map\[[^]]*\][^{]*|\[\][^{]*)\{\}[[:space:]]*$)/ || s ~ /^[A-Za-z0-9_]+[[:space:]]+(map\[|\[\]|\*)[^=]*$/) print FILENAME ":" FNR ": " $0
  }
' | emit layer-inject-dependencies

# layer-no-init-side-effects
g "$LIST" '^func init\(\)' | emit layer-no-init-side-effects

# layer-logic-in-internal
for d in pkg src; do [ -d "$d" ] && echo "$d/:1: $d/ folder in a server module" | emit layer-logic-in-internal; done
find . -mindepth 2 -name go.mod -not -path '*/vendor/*' -not -path '*/testdata/*' -not -path '*/node_modules/*' 2>/dev/null \
  | sed 's#^\./##; s#$#:1: nested go.mod#' | emit layer-logic-in-internal
find . -type d \( -name vendor -o -name testdata -o -name node_modules -o -name .git \) -prune -o -type d \
  \( -name util -o -name utils -o -name common -o -name shared -o -name lib -o -name helpers -o -name helper -o -name base -o -name misc -o -name types \) -print 2>/dev/null \
  | while read -r d; do ls "$d"/*.go >/dev/null 2>&1 && echo "${d#./}/:1: util-style package name"; done | emit layer-logic-in-internal
grep -E '^cmd/' "$LIST" | while read -r f; do n=$(wc -l < "$f"); [ "$n" -gt 300 ] && echo "$f:1: $n lines in cmd/ (move logic to internal/)"; done | emit layer-logic-in-internal

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
