#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the database rules of go-database that a script can find
# (rule files in go-database/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
# count per rule. Findings are candidates: confirm each against its rule file before reporting it.
# It complements go vet / golangci-lint, which find several of these exactly; run those too.
#
# Usage: bash scan.sh [module-root] [--strict]
#   module-root  the folder with go.mod (default .)
#   --strict     exit 1 when anything was found (for CI); default exit 0
# Env:
#   SQL_DIRS="internal/database internal/db internal/store internal/repository"
#                folders where SQL belongs (db-sql-in-data-layer)
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

# --- database ---------------------------------------------------------------------------------
# db-close-rows
scoped "$LIST" '^[[:space:]]*[A-Za-z_]*[Rr]ows,[[:space:]]*err[[:space:]]*:?=.*\.Query(Context)?\(' \
  '([Rr]ows\.Close\(\)|pgx\.(Collect|ForEachRow)|ForEachRow\()' 'rows|[A-Za-z_]*Rows' | emit db-close-rows

# db-tx-defer-rollback (the Rollback must be deferred; a plain call on one error path doesn't count)
scoped "$LIST" '^[[:space:]]*[A-Za-z_]*[Tt]x,[[:space:]]*err[[:space:]]*:?=.*\.Begin(Tx)?\(' \
  '(defer[[:space:]].*Rollback|defer[[:space:]]+func)' 'tx|[A-Za-z_]*Tx' | emit db-tx-defer-rollback

# db-context-on-queries
g "$LIST" '\.(Query|QueryRow|Exec|Prepare)\([[:space:]]*["`]' | emit db-context-on-queries

# db-sql-in-data-layer (one line per file: first statement and count)
SQLRE="$(dirs_re "${SQL_DIRS:-internal/database internal/db internal/store internal/repository}")"
g "$LIB" '(["`][[:space:]]*|^[[:space:]]*)(SELECT[[:space:]].*FROM|INSERT INTO[[:space:]]|UPDATE[[:space:]]+[a-z_]+[[:space:]]+SET|DELETE FROM[[:space:]])' \
  | grep -vE "$SQLRE" \
  | awk -F: '{ n[$1]++; if (!($1 in first)) first[$1]=$2 } END { for (f in n) printf "%s:%s: %d SQL statement(s) outside the data-access folders\n", f, first[f], n[f] }' \
  | sort | emit db-sql-in-data-layer

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
