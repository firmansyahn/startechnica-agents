#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the HTTP handler rules of go-http-handlers that a script can find
# (rule files in go-http-handlers/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
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

# --- HTTP API ---------------------------------------------------------------------------------
# api-limit-request-body
for f in $(xargs -d '\n' grep -lE 'json\.NewDecoder\(r\.Body\)|io\.ReadAll\(r\.Body\)|\.ParseForm\(\)|\.ParseMultipartForm\(' < "$LIST" 2>/dev/null); do
  grep -q 'MaxBytesReader' "$f" || grep -nHE 'json\.NewDecoder\(r\.Body\)|io\.ReadAll\(r\.Body\)|\.ParseForm\(\)|\.ParseMultipartForm\(' "$f" \
    | head -1 | sed 's/$/  (no MaxBytesReader in this file)/' | emit api-limit-request-body
done

# api-return-after-error
a "$LIST" '
  function nb(   l) { while ((getline l) > 0) { FNR_ = FNR_ + 1; if (l !~ /^[[:space:]]*$/) return l } return "\004EOF" }
  FNR==1 { FNR_=0 }
  { FNR_ = FNR }
  /^[[:space:]]*(http\.Error|[A-Za-z_.]*([Ww]rite|[Rr]espond|[Rr]ender|[Ss]end)[A-Za-z]*Error[A-Za-z]*)\(/ {
    start=FNR; txt=$0; depth=gsub(/\(/,"(")-gsub(/\)/,")")
    while (depth>0 && (getline l) > 0) { depth+=gsub(/\(/,"(",l)-gsub(/\)/,")",l) }
    l1=nb()
    if (l1 ~ /^[[:space:]]*(return|case |default:|panic\()/ || l1 ~ /^\}/ || l1 == "\004EOF") next
    if (l1 ~ /^[[:space:]]+\}[[:space:]]*$/) { l2=nb(); if (l2 ~ /^[[:space:]]*\}/ || l2 ~ /^[[:space:]]*(case |default:)/ || l2 ~ /^func / || l2 == "\004EOF") next }
    print FILENAME ":" start ": " txt
  }
' | emit api-return-after-error

# api-status-from-errors
g "$LIST" '(http\.Error\(|\.Write\(|WriteString\(|\.Encode\(|"(error|message|msg|detail)":[[:space:]]*).*[A-Za-z_]*[Ee]rr[A-Za-z]*\.Error\(\)' \
  | emit api-status-from-errors

# Function-scoped resource checks: an open (OPEN) must be followed, before the function's closing
# brace at column 0, by a release (OK); handing the value to another function (", v)" / "(v)") or
# returning it counts as a release, since the callee owns it then.
# usage: scoped <list> <open-regex> <ok-regex> <var-regex>
# (Regexes reach awk through ENVIRON: awk -v would eat their backslashes.)
scoped() { local l="$1"; export SC_OPEN="$2" SC_OK="$3" SC_V="$4"; a "$l" '
  BEGIN { open=ENVIRON["SC_OPEN"]; ok=ENVIRON["SC_OK"]; v=ENVIRON["SC_V"] }
  FNR==1 { if (mark) print pf ":" mark ": " mline; mark=0; pf=FILENAME }
  $0 ~ /^[[:space:]]*\/\// { next }
  mark && ($0 ~ ok || $0 ~ ("[(,][[:space:]]*(" v ")[[:space:]]*[,)]") || $0 ~ ("return[[:space:]](.*[^A-Za-z0-9_])?(" v ")([^A-Za-z0-9_]|$)")) { mark=0 }
  mark && /^\}/ { print FILENAME ":" mark ": " mline; mark=0 }
  $0 ~ open { mark=FNR; mline=$0 }
  END { if (mark) print pf ":" mark ": " mline }
'; }

# api-close-response-body
scoped "$LIST" '^[[:space:]]*(resp|res|response|httpResp|httpRes)([A-Z0-9][A-Za-z0-9]*)?,[[:space:]]*err[[:space:]]*:?=.*\.(Do|Get|Post|Head|PostForm)\(' \
  'Body\.Close\(\)' '(resp|res|response|httpResp|httpRes)([A-Z0-9][A-Za-z0-9]*)?' | emit api-close-response-body

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
