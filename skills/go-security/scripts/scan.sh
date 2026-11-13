#!/usr/bin/env bash
# scan.sh: read-only scan of a Go module for the security rules of go-security that a script can find
# (rule files in go-security/rules/). Prints one finding per line: <rule-id>\t<file>:<line>: <text>, then a
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

# --- security ---------------------------------------------------------------------------------
# sec-sql-parameterized
g "$LIB" 'fmt\.Sprintf\(.*\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|WHERE|ORDER BY|GROUP BY|VALUES)\b' | emit sec-sql-parameterized
# Concatenation onto a SQL literal. Treated as constant fragments and dropped: calls whose only
# argument is a string literal (a helper building "$1" references), and identifiers named like
# SQL constants (...Columns, ...Cols, ...SQL, ...Query, ...Select, ...Fields, ...Join(s), ...From).
g "$LIB" '["`][^"`]*\b(SELECT|WHERE|ORDER BY|GROUP BY|LIMIT|OFFSET|VALUES)\b[^"`]*["`][[:space:]]*\+[[:space:]]*[A-Za-z_(]' \
  | awk -v re='["`][^"`]*(SELECT|WHERE|ORDER BY|GROUP BY|LIMIT|OFFSET|VALUES)[^"`]*["`][[:space:]]*\\+[[:space:]]*[A-Za-z_(]' '{
      s=$0; sub(/^[^:]+:[0-9]+:/, "", s)
      gsub(/[A-Za-z_][A-Za-z0-9_.]*\("[^"]*"\)/, "\"\"", s)
      gsub(/\+[[:space:]]*[A-Za-z_][A-Za-z0-9_.]*(Columns|Cols|SQL|Sql|Query|Select|Fields|Joins?|From)([^A-Za-z0-9_(]|$)/, "+ \"\" ", s)
      if (s ~ re) print }' \
  | emit sec-sql-parameterized

# sec-tls-verify
g "$LIST" 'InsecureSkipVerify:[[:space:]]*true' | emit sec-tls-verify

# sec-crypto-rand
for f in $(xargs -d '\n' grep -lE '"math/rand(/v2)?"' < "$LIST" 2>/dev/null); do
  if grep -qiE '(token|secret|nonce|salt|password|otp|api_?key|session_?id)' "$f"; then
    grep -nHE '"math/rand(/v2)?"' "$f" | sed 's/$/  (file also mentions tokens\/secrets)/' | emit sec-crypto-rand
  fi
done

# sec-path-traversal
g "$LIST" '(os\.(Open|OpenFile|ReadFile|Create|WriteFile|Remove|RemoveAll|MkdirAll|ReadDir)|filepath\.Join|path\.Join|http\.ServeFile)\(.*(PathValue\(|FormValue\(|PostFormValue\(|URL\.Query\(\)|URLParam\(|mux\.Vars|Header\.Get\()' \
  | emit sec-path-traversal

# sec-no-secrets-in-logs
g "$LIST" "$LOGRE|log\.Print|slog\.(String|Any)\(|zap\.(String|Any|Reflect|ByteString)\(" \
  | grep -iE '"[a-z_.]*(password|passwd|secret|token|api_?key|dsn|authorization|cookie)[a-z_.]*"|[,(][[:space:]]*[A-Za-z_.]*(Password|Secret|Token|APIKey|ApiKey|DSN|Cookie)\b' \
  | grep -viE '"[a-z_.]*(_id|_type|_count|_len|_present|_hint|_prefix|_kind|_name)"' | emit sec-no-secrets-in-logs

# sec-constant-time-compare
g "$LIST" '\b[A-Za-z_]*(token|secret|signature|hmac|digest|apikey|api_key|password|passwd)[A-Za-z0-9_]*(\[[^]]*\])?(\.[A-Za-z_]+)*[[:space:]]*(==|!=)[[:space:]]*[A-Za-z_]' -i \
  | grep -vE '(==|!=)[[:space:]]*(nil|true|false|len\(|[A-Z][A-Za-z]*[A-Z][A-Za-z]*Type\b)' | emit sec-constant-time-compare
g "$LIST" 'bytes\.Equal\(.*(token|secret|signature|hmac|digest|api_?key)' -i | emit sec-constant-time-compare

# sec-http-server-timeouts
g "$LIST" '(^|[^A-Za-z_.])http\.(ListenAndServe|ListenAndServeTLS|Serve|ServeTLS)\(' | emit sec-http-server-timeouts
a "$LIST" '
  FNR==1 { inb=0 }
  !inb && /http\.Server\{/ && $0 !~ /^[[:space:]]*\/\// {
    inb=1; start=FNR; txt=$0; depth=gsub(/\{/,"{")-gsub(/\}/,"}"); buf=$0
    if (depth<=0) { inb=0; if (buf !~ /Read(Header)?Timeout/) print FILENAME ":" start ": " txt " (no ReadHeaderTimeout/ReadTimeout)" }
    next
  }
  inb { buf=buf $0; depth+=gsub(/\{/,"{")-gsub(/\}/,"}")
    if (depth<=0) { inb=0; if (buf !~ /Read(Header)?Timeout/) print FILENAME ":" start ": " txt " (no ReadHeaderTimeout/ReadTimeout)" } }
' | emit sec-http-server-timeouts

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm each against its rule file in rules/) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
