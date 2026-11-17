#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the MongoDB rules of go-mongodb that a script can find
# (rule files in go-mongodb/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
# count per rule. Findings are candidates: confirm each against its rule file before reporting it.
# It complements go vet / golangci-lint; run those too.
#
# Usage: bash scan.sh [module-root] [--strict]
#   module-root  the folder with go.mod (default .)
#   --strict     exit 1 when anything was found (for CI); default exit 0
# Env:
#   MONGO_DIRS="internal/platform/mongostore internal/mongostore internal/store internal/repository internal/database"
#                folders where the MongoDB client belongs (mongo-one-client)
#
# Only files that import go.mongodb.org/mongo-driver are checked. Skips vendor/, testdata/, third_party/,
# node_modules/, .git/ and generated files ("// Code generated ... DO NOT EDIT."). Tests (_test.go) are not
# checked. POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f go.mod ] || echo "warning: no go.mod in $ROOT; scanning anyway" >&2

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ALL="$TMP/all"; GEN="$TMP/gen"; SRC="$TMP/src"; LIST="$TMP/list"; MAIN="$TMP/main"; LIB="$TMP/lib"; OUT="$TMP/out"
: > "$OUT"

find . -type d \( -name vendor -o -name testdata -o -name third_party -o -name node_modules -o -name .git \) -prune \
  -o -type f -name '*.go' -print | sed 's#^\./##' | sort > "$ALL"
[ -s "$ALL" ] || { echo "no .go files under $ROOT" >&2; exit 2; }
xargs -d '\n' grep -lE '^// Code generated .* DO NOT EDIT\.$' < "$ALL" 2>/dev/null | sort > "$GEN"
grep -vE '_test\.go$' "$ALL" | comm -23 - "$GEN" > "$SRC"
# files that import the driver (v1 or v2)
xargs -d '\n' grep -lE '"go\.mongodb\.org/mongo-driver(/v2)?/' < "$SRC" 2>/dev/null | sort > "$LIST"
[ -s "$LIST" ] || { echo "no findings (no non-test file imports go.mongodb.org/mongo-driver)"; exit 0; }
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
# has <list> <regex>: true when any file in the list matches
has() { [ -s "$1" ] && xargs -d '\n' grep -qE -- "$2" < "$1" 2>/dev/null; }

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

OPS='Find|FindOne|FindOneAnd[A-Za-z]+|InsertOne|InsertMany|UpdateOne|UpdateMany|UpdateByID|ReplaceOne|DeleteOne|DeleteMany|Aggregate|CountDocuments|EstimatedDocumentCount|Distinct|BulkWrite|Watch|CreateOne|CreateMany|DropOne|RunCommand|WithTransaction|UseSession|Ping'

# --- client ------------------------------------------------------------------------------------
# mongo-one-client: Connect outside main and the MongoDB folders; Connect with no Disconnect anywhere
MONGORE="$(dirs_re "${MONGO_DIRS:-internal/platform/mongostore internal/mongostore internal/store internal/repository internal/database}")"
g "$LIB" '(^|[^A-Za-z0-9_])mongo\.Connect\(' | grep -vE "$MONGORE" \
  | sed 's/$/  (mongo.Connect outside main and MONGO_DIRS)/' | emit mongo-one-client
if has "$LIST" 'mongo\.Connect\(' && ! has "$LIST" '\.Disconnect\('; then
  g "$LIST" '(^|[^A-Za-z0-9_])mongo\.Connect\(' | head -1 | sed 's/$/  (no Disconnect anywhere in the module)/' | emit mongo-one-client
fi

# mongo-context-deadline: detached contexts on driver calls; a client with no timeout at all
g "$LIST" "\\.(${OPS})\\([[:space:]]*context\\.(Background|TODO)\\(\\)" | emit mongo-context-deadline
if has "$LIST" 'mongo\.Connect\(' && ! has "$LIST" '(SetTimeout\(|timeoutMS)'; then
  g "$LIST" '(^|[^A-Za-z0-9_])mongo\.Connect\(' | head -1 | sed 's/$/  (no SetTimeout or timeoutMS in the module)/' | emit mongo-context-deadline
fi

# --- login and app name ------------------------------------------------------------------------
# mongo-authenticated-connection: a client built where nothing sets or checks a login; a URI written
# into the code (it has no login, or it embeds a password)
if ! has "$LIST" '(SetAuth\(|checkLogin\(|\.Auth[[:space:]]*==[[:space:]]*nil)'; then
  g "$LIST" '(^|[^A-Za-z0-9_])mongo\.Connect\(' | sed 's/$/  (no SetAuth or login check in the module)/' | emit mongo-authenticated-connection
fi
g "$SRC" '"mongodb(\+srv)?://[A-Za-z0-9[]' | emit mongo-authenticated-connection
# mongo-app-name: a client built where nothing names it
if ! has "$LIST" 'SetAppName\('; then
  g "$LIST" '(^|[^A-Za-z0-9_])mongo\.Connect\(' | sed 's/$/  (no SetAppName in the module)/' | emit mongo-app-name
fi

# --- reads -------------------------------------------------------------------------------------
# mongo-close-cursor
CURV='cur|cursor|[A-Za-z_]*Cursor|[A-Za-z_]*Cur|cs|stream|[A-Za-z_]*Stream'
scoped "$LIST" "^[[:space:]]*(${CURV}),[[:space:]]*err[[:space:]]*:?=.*\\.(Find|Aggregate|Watch)\\(" \
  '\.(Close|All)\(' "$CURV" | emit mongo-close-cursor

# mongo-bounded-reads (candidates)
g "$LIST" '\.SetSkip\(' | emit mongo-bounded-reads

# --- safety ------------------------------------------------------------------------------------
# mongo-no-operator-injection: server-side JavaScript operators
g "$LIST" '["`]\$(where|function|accumulator)["`]' | emit mongo-no-operator-injection
# conversions of other values into filter documents
g "$LIST" 'bson\.(M|D)\([A-Za-z_]' | emit mongo-no-operator-injection
# JSON decoded into an untyped document in a file that uses the driver
a "$LIST" '
  FNR==1 { for (k in names) delete names[k] }
  /^[[:space:]]*\/\// { next }
  {
    line=$0
    if (match(line, /(var[[:space:]]+)?[A-Za-z_][A-Za-z0-9_]*[[:space:]]+(bson\.M|bson\.D|map\[string\](any|interface\{\}))/) ||
        match(line, /[A-Za-z_][A-Za-z0-9_]*[[:space:]]*:=[[:space:]]*(bson\.M|bson\.D|map\[string\](any|interface\{\}))\{/)) {
      d=substr(line, RSTART, RLENGTH); sub(/^var[[:space:]]+/, "", d); sub(/[^A-Za-z0-9_].*$/, "", d); names[d]=1
    }
    if (line ~ /json\.(Unmarshal|NewDecoder)/) {
      for (n in names) if (index(line, "&" n ")") || index(line, "&" n ",")) { print FILENAME ":" FNR ": " line; break }
    }
  }' | emit mongo-no-operator-injection

# mongo-translate-driver-errors (candidates)
g "$LIST" '([!=]=[[:space:]]*mongo\.ErrNoDocuments|mongo\.ErrNoDocuments[[:space:]]*[!=]=|E11000)' | emit mongo-translate-driver-errors

# --- transactions ------------------------------------------------------------------------------
# mongo-with-transaction: hand-rolled transactions; a callback whose context isn't named ctx (outer ctx stays usable)
g "$LIST" '\.StartTransaction\(' | emit mongo-with-transaction
g "$LIST" 'WithTransaction\(.*func\([A-Za-z_][A-Za-z0-9_]*[[:space:]]+(context\.Context|mongo\.SessionContext)' \
  | grep -vE 'func\(ctx[[:space:]]+context\.Context' | emit mongo-with-transaction

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
# never print a password found in a connection string
sed 's#\(mongodb[+a-z]*://\)[^"@/[:space:]]*@#\1<credentials>@#g' "$OUT" > "$OUT.redacted" && mv "$OUT.redacted" "$OUT"
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
