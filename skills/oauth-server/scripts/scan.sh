#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the authorization server rules of oauth-server that a script can
# find (rule files in oauth-server/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
# count per rule. Findings are candidates: confirm each against its rule file before reporting it.
# The flow tests in assets/ check the same rules exactly for the paths they run; run go-security's scan too
# (sec-no-secrets-in-logs) and golangci-lint with gosec (G404: math/rand).
#
# Usage: bash scan.sh [module-root] [--strict]
#   module-root  the folder with go.mod (default .)
#   --strict     exit 1 when anything was found (for CI); default exit 0
# Environment:
#   VERIFIER_DIRS  space-separated folders allowed to read bearer tokens and the token table: the one verifier
#                  and the protocol library's storage adapter (default: none, so every site is listed)
#   TOKEN_TABLES   regex of the token, code and grant table names (default: oauth_[a-z_]+)
#
# Skips vendor/, testdata/, third_party/, node_modules/, .git/ and generated files
# ("// Code generated ... DO NOT EDIT."). Tests (_test.go) are not checked; SQL migrations (*.sql) are.
# POSIX tools only (Linux, macOS, Git Bash on Windows).

set -u
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f go.mod ] || echo "warning: no go.mod in $ROOT; scanning anyway" >&2
VERIFIER_DIRS="${VERIFIER_DIRS:-}"
TOKEN_TABLES="${TOKEN_TABLES:-oauth_[a-z_]+}"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ALL="$TMP/all"; GEN="$TMP/gen"; LIST="$TMP/list"; TLIST="$TMP/tests"; MAIN="$TMP/main"; LIB="$TMP/lib"; OUT="$TMP/out"
SQL="$TMP/sql"; OUTSIDE="$TMP/outside"
: > "$OUT"

find . -type d \( -name vendor -o -name testdata -o -name third_party -o -name node_modules -o -name .git \) -prune \
  -o -type f -name '*.go' -print | sed 's#^\./##' | sort > "$ALL"
[ -s "$ALL" ] || { echo "no .go files under $ROOT" >&2; exit 2; }
xargs -d '\n' grep -lE '^// Code generated .* DO NOT EDIT\.$' < "$ALL" 2>/dev/null | sort > "$GEN"
grep -E '_test\.go$' "$ALL" > "$TLIST"
grep -vE '_test\.go$' "$ALL" | comm -23 - "$GEN" > "$LIST"
xargs -d '\n' grep -lE '^package main$' < "$LIST" 2>/dev/null | sort > "$MAIN"
comm -23 "$LIST" "$MAIN" > "$LIB"
find . -type d \( -name vendor -o -name testdata -o -name third_party -o -name node_modules -o -name .git \) -prune \
  -o -type f -name '*.sql' -print | sed 's#^\./##' | sort > "$SQL"

emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }
nocomment() { grep -vE '^[^:]+:[0-9]+:[[:space:]]*//'; }
# g <list> <regex> [grep flags]: matching lines as file:line:text, comment lines dropped
g() { local l="$1" re="$2"; shift 2; [ -s "$l" ] || return 0
  xargs -d '\n' grep -nHE "$@" -- "$re" < "$l" 2>/dev/null | nocomment | cut -c1-220; }
# a <list> [awk options] <awk program>: run awk (POSIX, no gawk extensions) over the files; the program prints file:line: text
a() { local l="$1"; shift; [ -s "$l" ] || return 0; xargs -d '\n' awk "$@" < "$l" 2>/dev/null | cut -c1-220; }
dirs_re() { local re=""; for d in $1; do re="${re:+$re|}^${d%/}/"; done; printf '%s' "${re:-^$}"; }

LOGRE='(^|[^A-Za-z0-9_])(log|logger|lg|l|slog|zap\.L\(\)|zap\.S\(\))[A-Za-z]*\.(Error|Warn|Info|Debug)[A-Za-z]*\(|log\.(Print|Fatal|Panic)'

# --- Tokens -----------------------------------------------------------------------------------
# oauth-opaque-hashed-tokens: a column that would hold a token, code or secret in clear
g "$SQL" '^[[:space:]]*"?(access_token|refresh_token|id_token|token|code|auth_code|authorization_code|client_secret|secret)"?[[:space:]]+(text|varchar|character varying|char|bytea|blob|string)' -i \
  | emit oauth-opaque-hashed-tokens
# ... and a token generator on math/rand instead of crypto/rand
for f in $(xargs -d '\n' grep -lE '"math/rand(/v2)?"' < "$LIST" 2>/dev/null); do
  grep -qiE 'token|secret|verifier|code' "$f" && grep -nHE '"math/rand(/v2)?"' "$f" | head -1 \
    | sed 's/$/  (math\/rand in a file that makes tokens or secrets: use crypto\/rand)/' | emit oauth-opaque-hashed-tokens
done

# --- Access -----------------------------------------------------------------------------------
# oauth-one-verifier: bearer tokens or the token table read outside the verifier
grep -vE "$(dirs_re "$VERIFIER_DIRS")" "$LIST" > "$OUTSIDE"
g "$OUTSIDE" "Header\.Get\(\"Authorization\"\)|(TrimPrefix|CutPrefix)\([^,]+,[[:space:]]*\"Bearer |(FROM|JOIN|UPDATE|INTO)[[:space:]]+\"?($TOKEN_TABLES)\"?([[:space:]]|\$|\")" -i \
  | emit oauth-one-verifier

# --- Pages and endpoints ----------------------------------------------------------------------
# oauth-never-log-credentials: a log call or access log carrying the request's form, query or body, or a credential field
g "$LIST" "$LOGRE|slog\.(String|Any)\(|zap\.(String|Any|Reflect|ByteString|Stringer)\(" \
  | grep -E '(^|[^A-Za-z0-9_])r(eq)?\.((Form|PostForm|RequestURI|Body)([^A-Za-z]|$)|URL(\.String\(\)|\.RawQuery|\.Query\(\))?[[:space:]]*[,)])|"(code|code_verifier|client_secret|refresh_token|access_token|id_token|password|assertion)"' \
  | emit oauth-never-log-credentials
g "$LIST" 'httputil\.DumpRequest(Out)?\(' | emit oauth-never-log-credentials

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
