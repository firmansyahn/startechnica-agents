#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the error-handling rules of go-error-handling that a script can find
# (rule files in go-error-handling/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
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

# --- errors -----------------------------------------------------------------------------------
# err-match-with-is-as
g "$LIST" '\b[A-Za-z_]*[Ee]rr[A-Za-z]*[[:space:]]*(==|!=)[[:space:]]*([A-Za-z_]+\.)?Err[A-Z][A-Za-z]*\b|\b[A-Za-z_]*[Ee]rr[A-Za-z]*[[:space:]]*(==|!=)[[:space:]]*context\.(Canceled|DeadlineExceeded)' \
  | emit err-match-with-is-as
g "$LIST" '\.Error\(\)[[:space:]]*(==|!=)|strings\.(Contains|HasPrefix|HasSuffix|EqualFold)\([A-Za-z_.]*[Ee]rr[A-Za-z]*\.Error\(\)' \
  | emit err-match-with-is-as

# err-no-panic (outside main, tests, Must* helpers and init)
a "$LIB" '
  /^func / { fn=$0 }
  /(^|[^A-Za-z0-9_.])panic\(/ && $0 !~ /^[[:space:]]*\/\// && fn !~ /^func (\([^)]*\) )?(Must[A-Z_]|must[A-Z_]|init\()/ { print FILENAME ":" FNR ": " $0 }
' | emit err-no-panic

# err-handle-once (log mentioning err, then return ... err within 3 lines)
export LOGRE
a "$LIST" '
  BEGIN { re=ENVIRON["LOGRE"] }
  FNR==1 { mark=0 }
  /^func / { mark=0 }
  $0 ~ /^[[:space:]]*\/\// { next }
  $0 ~ re && $0 ~ /(^|[^A-Za-z0-9_])err([^A-Za-z0-9_]|$)/ { mark=FNR; mline=$0; next }
  mark && FNR-mark<=3 && /^[[:space:]]*return .*(^|[^A-Za-z0-9_])err([^A-Za-z0-9_.]|$)/ { print FILENAME ":" mark ": " mline; mark=0 }
  mark && FNR-mark>3 { mark=0 }
' | emit err-handle-once

# err-wrap-with-w
g "$LIST" 'fmt\.Errorf\(.*%[vs].*,[[:space:]]*[A-Za-z_]*[Ee]rr[A-Za-z]*\)[[:space:]]*$|fmt\.Errorf\(.*%[vs].*,[[:space:]]*[A-Za-z_]*[Ee]rr[A-Za-z]*\)[^(]' \
  | grep -v '%w' | emit err-wrap-with-w
g "$LIST" '(fmt\.Errorf|errors\.New)\("([Ff]ailed to|[Uu]nable to|[Cc]ould not|[Ee]rror )' | emit err-wrap-with-w

# err-exit-only-in-main
g "$LIB" '(os\.Exit\(|log\.(Fatal|Panic)[a-z]*\(|\.Fatal[a-z]*\()' \
  | grep -vE '(^|[^A-Za-z0-9_])(t|tb|b|f)\.Fatal' | emit err-exit-only-in-main

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
