#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the concurrency rules of go-concurrency that a script can find
# (rule files in go-concurrency/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
# count per rule. Findings are candidates: confirm each against its rule file before reporting it.
# It complements go vet / golangci-lint, which find several of these exactly; run those too.
#
# Usage: bash scan.sh [module-root] [--strict]
#   module-root  the folder with go.mod (default .)
#   --strict     exit 1 when anything was found (for CI); default exit 0
# Env:
#   CTX_ROOT_DIRS="cmd internal/app"   folders allowed to create root contexts (conc-context-propagation)
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

# --- concurrency ------------------------------------------------------------------------------
# conc-context-propagation
CTXRE="$(dirs_re "${CTX_ROOT_DIRS:-cmd internal/app}")"
g "$LIB" 'context\.(Background|TODO)\(\)' | grep -vE "$CTXRE" | emit conc-context-propagation

# conc-outbound-timeouts
g "$LIST" '(^|[^A-Za-z0-9_.])http\.(Get|Post|Head|PostForm)\(|http\.DefaultClient|&http\.Client\{\}|http\.NewRequest\(' \
  | emit conc-outbound-timeouts

# conc-mutex-field
g "$LIST" '^[[:space:]]+\*?sync\.(Mutex|RWMutex)[[:space:]]*(//.*)?$|^[[:space:]]+[A-Za-z_][A-Za-z0-9_]*[[:space:]]+\*sync\.(Mutex|RWMutex)\b|new\(sync\.(Mutex|RWMutex)\)' \
  | emit conc-mutex-field

# conc-channel-size (literal buffer > 1 with no comment on the line or the line above)
a "$LIST" '
  FNR==1 { prev="" }
  /make\(chan [^,]+,[[:space:]]*([2-9]|[1-9][0-9]+)\)/ && $0 !~ /\/\// && prev !~ /^[[:space:]]*\/\// { print FILENAME ":" FNR ": " $0 }
  { prev=$0 }
' | emit conc-channel-size

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
