#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the Kafka (franz-go) rules of go-kafka that a script can find
# (rule files in go-kafka/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
# count per rule. Findings are candidates: confirm each against its rule file before reporting it.
# It complements go vet / golangci-lint; run those too.
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
ALL="$TMP/all"; GEN="$TMP/gen"; LIST="$TMP/list"; MAIN="$TMP/main"; LIB="$TMP/lib"; OUT="$TMP/out"
: > "$OUT"

find . -type d \( -name vendor -o -name testdata -o -name third_party -o -name node_modules -o -name .git \) -prune \
  -o -type f -name '*.go' -print | sed 's#^\./##' | sort > "$ALL"
[ -s "$ALL" ] || { echo "no .go files under $ROOT" >&2; exit 2; }
xargs -d '\n' grep -lE '^// Code generated .* DO NOT EDIT\.$' < "$ALL" 2>/dev/null | sort > "$GEN"
grep -vE '_test\.go$' "$ALL" | comm -23 - "$GEN" > "$LIST"
xargs -d '\n' grep -lE '^package main$' < "$LIST" 2>/dev/null | sort > "$MAIN"
comm -23 "$LIST" "$MAIN" > "$LIB"

# Only files that use franz-go are of interest.
KGO="$TMP/kgo"
xargs -d '\n' grep -lE '"github\.com/twmb/franz-go/pkg/kgo"' < "$LIST" 2>/dev/null | sort > "$KGO"
if [ ! -s "$KGO" ]; then echo "no findings (no file imports github.com/twmb/franz-go/pkg/kgo)"; exit 0; fi
KLIB="$TMP/klib"; comm -12 "$KGO" "$LIB" > "$KLIB"

emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }
nocomment() { grep -vE '^[^:]+:[0-9]+:[[:space:]]*//'; }
# g <list> <regex> [grep flags]: matching lines as file:line:text, comment lines dropped
g() { local l="$1" re="$2"; shift 2; [ -s "$l" ] || return 0
  xargs -d '\n' grep -nHE "$@" -- "$re" < "$l" 2>/dev/null | nocomment | cut -c1-220; }
# a <list> [awk options] <awk program>: run awk (POSIX, no gawk extensions) over the files; the program prints file:line: text
a() { local l="$1"; shift; [ -s "$l" ] || return 0; xargs -d '\n' awk "$@" < "$l" 2>/dev/null | cut -c1-220; }
# files <list> <regex>: the files of the list that contain the regex
files() { local l="$1" re="$2"; [ -s "$l" ] || return 0; xargs -d '\n' grep -lE -- "$re" < "$l" 2>/dev/null | sort; }
# any <list> <regex>: true when some file of the list contains the regex
any() { [ -n "$(files "$1" "$2" | head -1)" ]; }
# first <file> <regex>: file:line: text of the first match
first() { grep -nHE -- "$2" "$1" 2>/dev/null | nocomment | head -1 | cut -c1-220; }

POLLRE='\.Poll(Fetches|Records)\('

# --- kafka-check-errors ---------------------------------------------------------------------------
# Produce with a nil promise
g "$KGO" '\.(Try)?Produce\(.*,[[:space:]]*nil\)[[:space:]]*$' | emit kafka-check-errors
# ProduceSync as a bare statement: its ProduceResults (and so its errors) are discarded
g "$KGO" '^[[:space:]]*[A-Za-z_][A-Za-z0-9_.]*\.ProduceSync\(' | emit kafka-check-errors
# a file that polls and never reads the fetch errors
for f in $(files "$KGO" "$POLLRE"); do
  grep -qE '\.(Errors|EachError|Err0|Err)\(' "$f" || first "$f" "$POLLRE" | sed 's/$/  (fetch errors never read in this file)/' | emit kafka-check-errors
done

# --- kafka-commit-after-processing ----------------------------------------------------------------
g "$KGO" 'GreedyAutoCommit\(' | emit kafka-commit-after-processing
if ! any "$KGO" '(DisableAutoCommit|AutoCommitMarks|NewGroupTransactSession)\('; then
  for f in $(files "$KGO" "$POLLRE"); do
    grep -qE '^[[:space:]]*go[[:space:]]' "$f" && first "$f" "$POLLRE" \
      | sed 's/$/  (polls and starts goroutines under default autocommit)/' | emit kafka-commit-after-processing
  done
fi

# --- kafka-durable-writes -------------------------------------------------------------------------
g "$KGO" '(LeaderAck|NoAck|DisableIdempotentWrite|AllowAutoTopicCreation)\(\)' | emit kafka-durable-writes

# --- kafka-bounded-concurrency --------------------------------------------------------------------
# a go statement within six lines after EachRecord( or a range over Records
a "$KGO" '
  FNR==1 { m=0 }
  /^[[:space:]]*\/\// { next }
  /^\}/ { m=0 }
  m && FNR-m<=6 && /^[[:space:]]*go[[:space:]]/ { print FILENAME ":" FNR ": " $0; m=0 }
  /EachRecord\(|range[[:space:]].*\.Records([^A-Za-z0-9_]|$)/ { m=FNR }
' | emit kafka-bounded-concurrency

# --- kafka-graceful-shutdown ----------------------------------------------------------------------
# a library function that builds a client and closes it before returning: a client per call
a "$KLIB" '
  FNR==1 { open=0 }
  /^[[:space:]]*\/\// { next }
  /^func[[:space:]]/ { open=0 }
  /kgo\.NewClient\(/ { open=FNR; line=$0 }
  open && /defer[[:space:]].*\.Close\(\)/ { print FILENAME ":" open ": " line "  (client built and closed in one function)"; open=0 }
' | emit kafka-graceful-shutdown
# async produce somewhere, but no Flush anywhere in the module
if ! any "$KGO" '\.Flush\('; then
  g "$KGO" '\.(Try)?Produce\(' | sed 's/$/  (no Flush in the module)/' | emit kafka-graceful-shutdown
fi

# --- kafka-authenticated-connection ---------------------------------------------------------------
# clients built in a module where no non-test file logs in
if ! any "$KGO" 'kgo\.SASL\('; then
  g "$KGO" 'kgo\.NewClient\(' | sed 's/$/  (no kgo.SASL in the module)/' | emit kafka-authenticated-connection
fi
# login made optional: SASL only when the settings name a mechanism
g "$LIST" 'if[[:space:]].*\.Mechanism[[:space:]]*(!=|==)[[:space:]]*""' | emit kafka-authenticated-connection

# --- kafka-stable-consumer-group ------------------------------------------------------------------
# a group ID generated at start: on the ConsumerGroup line, or through a variable assigned from a
# generated value earlier in the same function (a pod name in InstanceID is fine and not flagged)
export SC_GEN='(uuid\.|UUID|rand\.|[Hh]ostname|HOSTNAME|POD_NAME|time\.Now|Getpid)'
a "$KGO" '
  BEGIN { gen=ENVIRON["SC_GEN"] }
  FNR==1 { vars="" }
  /^[[:space:]]*\/\// { next }
  /^func[[:space:]]/ { vars="" }
  /ConsumerGroup\(/ {
    hit = ($0 ~ gen); n = split(vars, v, " ")
    for (i = 1; i <= n; i++) if ($0 ~ ("[^A-Za-z0-9_]" v[i] "[^A-Za-z0-9_]")) hit = 1
    if (hit) print FILENAME ":" FNR ": " $0 "  (group ID built from a generated value)"
    next
  }
  $0 ~ gen && /:?=/ && match($0, /^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*/) {
    name = substr($0, RSTART, RLENGTH); gsub(/[[:space:]]/, "", name); vars = vars " " name
  }
' | emit kafka-stable-consumer-group
# a file that consumes with neither a group nor an explicit start offset
for f in $(files "$KGO" '(ConsumeTopics|ConsumePartitions|ConsumeRegex)\('); do
  grep -qE '(ConsumerGroup|ConsumeStartOffset)\(' "$f" || first "$f" '(ConsumeTopics|ConsumePartitions|ConsumeRegex)\(' \
    | sed 's/$/  (consumes without a group or an explicit start offset)/' | emit kafka-stable-consumer-group
done

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
