#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the ClickHouse rules of go-clickhouse that a script can find
# (rule files in go-clickhouse/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
# count per rule. Findings are candidates: confirm each against its rule file before reporting it.
#
# Usage: bash scan.sh [module-root] [--strict]
#   module-root  the folder with go.mod (default .)
#   --strict     exit 1 when anything was found (for CI); default exit 0
#
# Most checks look only at files that import github.com/ClickHouse/clickhouse-go/v2 (or its lib/driver);
# the SQL-text checks (ch-async-insert-wait, the ALTER/OPTIMIZE part of ch-no-mutations) look at every file.
# Skips vendor/, testdata/, third_party/, node_modules/, .git/ and generated files
# ("// Code generated ... DO NOT EDIT."). Tests (_test.go) are not checked.
# POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f go.mod ] || echo "warning: no go.mod in $ROOT; scanning anyway" >&2

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ALL="$TMP/all"; GEN="$TMP/gen"; LIST="$TMP/list"; MAIN="$TMP/main"; CH="$TMP/ch"; CHLIB="$TMP/chlib"; OUT="$TMP/out"
: > "$OUT"

find . -type d \( -name vendor -o -name testdata -o -name third_party -o -name node_modules -o -name .git \) -prune \
  -o -type f -name '*.go' -print | sed 's#^\./##' | sort > "$ALL"
[ -s "$ALL" ] || { echo "no .go files under $ROOT" >&2; exit 2; }
xargs -d '\n' grep -lE '^// Code generated .* DO NOT EDIT\.$' < "$ALL" 2>/dev/null | sort > "$GEN"
grep -vE '_test\.go$' "$ALL" | comm -23 - "$GEN" > "$LIST"
xargs -d '\n' grep -lE '^package main$' < "$LIST" 2>/dev/null | sort > "$MAIN"
xargs -d '\n' grep -lE '"github\.com/ClickHouse/clickhouse-go/v2(/lib/driver)?"' < "$LIST" 2>/dev/null | sort > "$CH"
comm -23 "$CH" "$MAIN" > "$CHLIB"

emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }
nocomment() { grep -vE '^[^:]+:[0-9]+:[[:space:]]*//'; }
# g <list> <regex> [grep flags]: matching lines as file:line:text, comment lines dropped
g() { local l="$1" re="$2"; shift 2; [ -s "$l" ] || return 0
  xargs -d '\n' grep -nHE "$@" -- "$re" < "$l" 2>/dev/null | nocomment | cut -c1-220; }
# a <list> [awk options] <awk program>: run awk (POSIX, no gawk extensions) over the files; the program prints file:line: text
a() { local l="$1"; shift; [ -s "$l" ] || return 0; xargs -d '\n' awk "$@" < "$l" 2>/dev/null | cut -c1-220; }

# Function-scoped resource checks: an open (OPEN) must be followed, before the function's closing
# brace at column 0, by a release (OK); handing the value to another function (", v)" / "(v)") or
# returning the value itself counts as a release, since the callee owns it then. "return v.Send()"
# is a method call on it, not a hand-off, and doesn't count.
# usage: scoped <list> <open-regex> <ok-regex> <var-regex>
# (Regexes reach awk through ENVIRON: awk -v would eat their backslashes.)
scoped() { local l="$1"; export SC_OPEN="$2" SC_OK="$3" SC_V="$4"; a "$l" '
  BEGIN { open=ENVIRON["SC_OPEN"]; ok=ENVIRON["SC_OK"]; v=ENVIRON["SC_V"] }
  FNR==1 { if (mark) print pf ":" mark ": " mline; mark=0; pf=FILENAME }
  $0 ~ /^[[:space:]]*\/\// { next }
  mark && ($0 ~ ok || $0 ~ ("[(,][[:space:]]*(" v ")[[:space:]]*[,)]") || $0 ~ ("return[[:space:]](.*[^A-Za-z0-9_.])?(" v ")([^A-Za-z0-9_.(]|$)")) { mark=0 }
  mark && /^\}/ { print FILENAME ":" mark ": " mline; mark=0 }
  $0 ~ open { mark=FNR; mline=$0 }
  END { if (mark) print pf ":" mark ": " mline }
'; }

# --- connection and queries --------------------------------------------------------------------
# ch-bind-parameters (candidates): SQL text built with Sprintf or concatenation
g "$CH" 'fmt\.Sprintf\([[:space:]]*["`][^"`]*(SELECT|INSERT|WHERE|FROM|ALTER|DELETE|ORDER BY|GROUP BY)' | emit ch-bind-parameters
g "$CH" 'fmt\.Sprintf\([[:space:]]*`[[:space:]]*$' | sed 's/$/  (multi-line Sprintf: check for SQL)/' | emit ch-bind-parameters
g "$CH" '["`][^"`]*(WHERE|AND|OR|=|IN \(|LIKE)[[:space:]]*'"'"'?["`][[:space:]]*\+[[:space:]]*[A-Za-z_]' | emit ch-bind-parameters

# ch-one-conn (candidates): more than one place opens a connection outside main and tests
OPENS="$TMP/opens"
g "$CHLIB" 'clickhouse\.(Open|OpenDB)\(' > "$OPENS"
if [ "$(wc -l < "$OPENS")" -gt 1 ]; then sed 's/$/  (one of several clickhouse.Open calls)/' "$OPENS" | emit ch-one-conn; fi
a "$CHLIB" '
  FNR==1 { inh=0 }
  /^func .*http\.ResponseWriter/ { inh=1 }
  /^\}/ { inh=0 }
  inh && /clickhouse\.(Open|OpenDB)\(/ { print FILENAME ":" FNR ": " $0 "  (opened inside an HTTP handler)" }
' | emit ch-one-conn

# ch-context-deadline
g "$CH" '\.(Query|QueryRow|Select|Exec|PrepareBatch|Ping|AsyncInsert)\([[:space:]]*context\.(Background|TODO)\(\)' | emit ch-context-deadline

# ch-close-rows
scoped "$CH" '^[[:space:]]*[A-Za-z_]*[Rr]ows,[[:space:]]*err[[:space:]]*:?=.*\.Query\(' \
  '[A-Za-z_]*[Rr]ows\.Close\(\)' 'rows|[A-Za-z_]*Rows' | emit ch-close-rows

# --- inserts -----------------------------------------------------------------------------------
# ch-batch-inserts (candidates): a single-statement INSERT through Exec (INSERT ... SELECT excluded),
# and PrepareBatch inside the body of a for loop
g "$CH" '\.Exec\([^,]*,[[:space:]]*["`][[:space:]]*INSERT[[:space:]]+INTO' -i | grep -viE 'INSERT[[:space:]]+INTO[^"`]*SELECT' | emit ch-batch-inserts
a "$CH" '
  FNR==1 { d=0; n=0 }
  /^[[:space:]]*\/\// { next }
  { line=$0; o=gsub(/\{/, "{", line); c=gsub(/\}/, "}", line) }
  /^[[:space:]]*for([[:space:]]|\{)/ { stack[++n]=d+1 }
  n>0 && d>=stack[n] && /\.PrepareBatch\(/ { print FILENAME ":" FNR ": " $0 "  (PrepareBatch inside a loop: one INSERT per iteration)" }
  { d+=o-c; while (n>0 && d<stack[n]) n-- }
' | emit ch-batch-inserts

# ch-close-batch (the Close or Abort must be deferred)
scoped "$CH" '^[[:space:]]*[A-Za-z_]*[Bb]atch,[[:space:]]*err[[:space:]]*:?=.*\.PrepareBatch\(' \
  '(defer[[:space:]].*\.(Close|Abort)\(\)|defer[[:space:]]+func)' 'batch|[A-Za-z_]*Batch' | emit ch-close-batch

# ch-async-insert-wait
g "$LIST" '(WithAsync|WithStdAsync)\([[:space:]]*false[[:space:]]*\)|AsyncInsert\(.*,[[:space:]]*false[[:space:]]*[,)]|wait_for_async_insert["'"'"'`]?[[:space:]]*[:=,][[:space:]]*["'"'"'`]?0([^0-9]|$)' | emit ch-async-insert-wait

# ch-no-mutations: ALTER ... UPDATE/DELETE and OPTIMIZE anywhere in Go code; DELETE FROM in clickhouse-go files
g "$LIST" 'ALTER[[:space:]]+TABLE[^"`]*[[:space:]](UPDATE|DELETE)([[:space:]]|$)|OPTIMIZE[[:space:]]+TABLE' -i | emit ch-no-mutations
g "$CH" '["`][[:space:]]*DELETE[[:space:]]+FROM[[:space:]]' -i | emit ch-no-mutations

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
