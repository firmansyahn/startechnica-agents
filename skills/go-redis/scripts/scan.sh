#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the Redis rules of go-redis that a script can find
# (rule files in go-redis/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
# count per rule. Findings are candidates: confirm each against its rule file before reporting it.
# It complements go vet / golangci-lint; run those too.
#
# Usage: bash scan.sh [module-root] [--strict]
#   module-root  the folder with go.mod (default .)
#   --strict     exit 1 when anything was found (for CI); default exit 0
#
# Only files that import github.com/redis/go-redis are checked. Skips vendor/, testdata/, third_party/,
# node_modules/, .git/ and generated files ("// Code generated ... DO NOT EDIT."). Tests (_test.go) are
# not checked. POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f go.mod ] || echo "warning: no go.mod in $ROOT; scanning anyway" >&2

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ALL="$TMP/all"; GEN="$TMP/gen"; LIST="$TMP/list"; RALL="$TMP/rall"; MAIN="$TMP/main"; RLIB="$TMP/rlib"; OUT="$TMP/out"
: > "$OUT"

find . -type d \( -name vendor -o -name testdata -o -name third_party -o -name node_modules -o -name .git \) -prune \
  -o -type f -name '*.go' -print | sed 's#^\./##' | sort > "$ALL"
[ -s "$ALL" ] || { echo "no .go files under $ROOT" >&2; exit 2; }
xargs -d '\n' grep -lE '^// Code generated .* DO NOT EDIT\.$' < "$ALL" 2>/dev/null | sort > "$GEN"
grep -vE '_test\.go$' "$ALL" | comm -23 - "$GEN" > "$LIST"
# files that use go-redis (the client, redisotel, or a sub-package)
xargs -d '\n' grep -lE '"github\.com/redis/go-redis/' < "$LIST" 2>/dev/null | sort > "$RALL"
[ -s "$RALL" ] || { echo "no findings (no non-test file imports github.com/redis/go-redis)"; exit 0; }
xargs -d '\n' grep -lE '^package main$' < "$RALL" 2>/dev/null | sort > "$MAIN"
comm -23 "$RALL" "$MAIN" > "$RLIB"

emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }
nocomment() { grep -vE '^[^:]+:[0-9]+:[[:space:]]*//'; }
# g <list> <regex> [grep flags]: matching lines as file:line:text, comment lines dropped
g() { local l="$1" re="$2"; shift 2; [ -s "$l" ] || return 0
  xargs -d '\n' grep -nHE "$@" -- "$re" < "$l" 2>/dev/null | nocomment | cut -c1-220; }
# a <list> [awk options] <awk program>: run awk (POSIX, no gawk extensions) over the files; the program prints file:line: text
a() { local l="$1"; shift; [ -s "$l" ] || return 0; xargs -d '\n' awk "$@" < "$l" 2>/dev/null | cut -c1-220; }
# lacking <list> <has-regex> <lacks-regex> <message>: files with a non-comment line matching has-regex and
# none matching lacks-regex; prints the first has-regex line with the message
lacking() { local l="$1"; export LK_HAS="$2" LK_LACKS="$3" LK_MSG="$4"; a "$l" '
  BEGIN { has=ENVIRON["LK_HAS"]; lacks=ENVIRON["LK_LACKS"]; msg=ENVIRON["LK_MSG"] }
  function flush() { if (first && !ok) print pf ":" first ": " msg; first=0; ok=0 }
  FNR==1 { flush(); pf=FILENAME }
  $0 ~ /^[[:space:]]*\/\// { next }
  $0 ~ lacks { ok=1 }
  !first && $0 ~ has { first=FNR }
  END { flush() }
'; }

CTOR='redis\.New(Client|ClusterClient|FailoverClient|FailoverClusterClient|UniversalClient|Ring)\('

# --- client -----------------------------------------------------------------------------------
# redis-one-client (a): a client built inside a function that isn't a constructor, main or run
export RC_CTOR="$CTOR"; a "$RALL" '
  BEGIN { ctor=ENVIRON["RC_CTOR"] }
  $0 ~ /^[[:space:]]*\/\// { next }
  /^func / { fn=$0; sub(/^func[[:space:]]+(\([^)]*\)[[:space:]]*)?/, "", fn); sub(/[[(].*/, "", fn) }
  $0 ~ ctor && fn !~ /^(New|new|Open|open|Connect|connect|main$|run$)/ { print FILENAME ":" FNR ": client built in " fn "(): " $0 }
' | emit redis-one-client
# redis-one-client (b): main/run builds a client and the file never calls Close()
a "$RALL" '
  BEGIN { ctor=ENVIRON["RC_CTOR"] }
  function flush() { if (first && !closed) print pf ":" first ": client built in main/run, no Close() in the file: " fl; first=0; closed=0 }
  FNR==1 { flush(); pf=FILENAME }
  $0 ~ /^[[:space:]]*\/\// { next }
  /^func / { fn=$0; sub(/^func[[:space:]]+(\([^)]*\)[[:space:]]*)?/, "", fn); sub(/[[(].*/, "", fn) }
  /\.Close\(\)/ { closed=1 }
  !first && $0 ~ ctor && fn ~ /^(main|run)$/ { first=FNR; fl=$0 }
  END { flush() }
' | emit redis-one-client

# redis-context-deadline (a): a detached context passed straight to a call, outside main
g "$RLIB" '(^|[^A-Za-z0-9_])([A-Za-z_]*[Rr]db|[A-Za-z_]*[Cc]lient|[Pp]ipe|tx|p)\.[A-Z][A-Za-z]*\([[:space:]]*context\.(Background|TODO)\(\)' \
  | emit redis-context-deadline
# redis-context-deadline (b): an options literal with no ContextTimeoutEnabled in the next 40 lines
a "$RALL" '
  FNR==1 { if (mark) print pf ":" mark ": options without ContextTimeoutEnabled: " mline; mark=0; pf=FILENAME }
  $0 ~ /^[[:space:]]*\/\// { next }
  mark && /ContextTimeoutEnabled/ { mark=0 }
  mark && FNR - mark > 40 { print FILENAME ":" mark ": options without ContextTimeoutEnabled: " mline; mark=0 }
  /redis\.(Options|ClusterOptions|FailoverOptions|UniversalOptions|RingOptions)\{/ { if (mark) print FILENAME ":" mark ": options without ContextTimeoutEnabled: " mline; mark=FNR; mline=$0; if ($0 ~ /ContextTimeoutEnabled/) mark=0 }
  END { if (mark) print pf ":" mark ": options without ContextTimeoutEnabled: " mline }
' | emit redis-context-deadline

# redis-otel-no-db-statement: InstrumentTracing with no WithDBStatement(false) on it or the next two lines
a "$RALL" '
  FNR==1 { if (mark) print pf ":" mark ": " mline; mark=0; pf=FILENAME }
  $0 ~ /^[[:space:]]*\/\// { next }
  mark && /WithDBStatement\(false\)/ { mark=0 }
  mark && FNR - mark > 2 { print FILENAME ":" mark ": " mline; mark=0 }
  /redisotel\.InstrumentTracing\(/ { if (mark) print FILENAME ":" mark ": " mline; mark=FNR; mline=$0; if ($0 ~ /WithDBStatement\(false\)/) mark=0 }
  END { if (mark) print pf ":" mark ": " mline }
' | emit redis-otel-no-db-statement

# --- keys and commands ------------------------------------------------------------------------
# redis-nil-is-miss
g "$RALL" '([!=]=[[:space:]]*redis\.Nil([^A-Za-z0-9_]|$)|redis\.Nil[[:space:]]*[!=]=)' | emit redis-nil-is-miss

# redis-ttl-on-keys (a): SET / SETNX with a zero expiration
g "$RALL" '\.(Set|SetNX)\(.*,[[:space:]]*0[[:space:]]*\)' | emit redis-ttl-on-keys
# redis-ttl-on-keys (b): collections or counters written in a file that never sets an expiry
lacking "$RALL" '\.(HSet|HSetNX|SAdd|RPush|LPush|ZAdd|Incr|IncrBy|HIncrBy|PFAdd)\(' \
  '(Expire|PExpire|ExpireNX|ExpireAt|HExpire|EXPIRE|KeepTTL)' \
  'writes a collection or counter; no Expire/PExpire in the file' | emit redis-ttl-on-keys

# redis-no-keys-command: KEYS and FLUSH*; full reads of collections as candidates
g "$RALL" '\.(Keys\(([A-Za-z_.]*[Cc]tx|[A-Za-z_.]*Context\(\))[[:space:]]*,|FlushAll\(|FlushDB\(|FlushAllAsync\(|FlushDBAsync\()' | emit redis-no-keys-command
g "$RALL" '(\.(SMembers|HGetAll)\(|\.LRange\(.*,[[:space:]]*0,[[:space:]]*-1[[:space:]]*\))' \
  | sed 's/$/  (candidate: fine only on a collection kept small)/' | emit redis-no-keys-command

# --- concurrency ------------------------------------------------------------------------------
# redis-lock-token-release (a): a lock with no expiry
g "$RALL" 'SetNX\(.*,[[:space:]]*0[[:space:]]*\)' | emit redis-lock-token-release
# redis-lock-token-release (b): SetNX plus a plain Del, and no token-checking script
lacking "$RALL" 'SetNX\(' '(NewScript|DelExArgs|redislock)' 'SetNX with no token-checking release script in the file' \
  > "$TMP/lk"
if [ -s "$TMP/lk" ]; then
  while IFS= read -r line; do f="${line%%:*}"; grep -qE '\.Del\(' "$f" 2>/dev/null && printf '%s\n' "$line"; done < "$TMP/lk" \
    | emit redis-lock-token-release
fi

# redis-stream-ack-after-processing (a): consumer group reads that skip the pending list
g "$RALL" 'NoAck:[[:space:]]*true' | emit redis-stream-ack-after-processing
# redis-stream-ack-after-processing (b): a consumer that never reclaims a dead consumer's entries
lacking "$RALL" 'XReadGroup\(' '(XAutoClaim|XClaim)' 'XReadGroup with no XAutoClaim/XClaim in the file' \
  | emit redis-stream-ack-after-processing

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
