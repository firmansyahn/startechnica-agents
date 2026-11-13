#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-bff rules a script can detect (sec-no-tokens-in-browser, struct-server-only).
# Prints one finding per line: <rule-id>\t<file>:<line> <text>, then a count per rule.
# Findings are candidates: confirm each against this skill's rules/<rule-id>.md before reporting it.
#
# Usage: bash scan.sh [app-root] [--strict]
#   app-root  the folder with the app's package.json (default .)
#   --strict  exit 1 when anything was found (for CI); default exit 0
# Env: SRC_DIRS="app components src" chooses the folders scanned for code.

set -u
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }

DIRS=()
for d in ${SRC_DIRS:-app components src}; do [ -d "$d" ] && DIRS+=("$d"); done
[ -f proxy.ts ] && DIRS+=(proxy.ts)
[ -f middleware.ts ] && DIRS+=(middleware.ts)
[ ${#DIRS[@]} -eq 0 ] && { echo "no source folders found under $ROOT" >&2; exit 2; }

SKIP=(--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=dist --exclude-dir=build
      --exclude-dir=coverage --exclude-dir=playwright-report --exclude='*.test.ts' --exclude='*.test.tsx'
      --exclude='*.spec.ts' --exclude='*.spec.tsx' --exclude='*.gen.ts' --exclude='*.d.ts')
CODE=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs')

OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT
emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }
# grep lets the last matching --include/--exclude win, so the includes go first and the excludes after.
# Comment lines (// and JSDoc *) are dropped.
g() { grep -rnE "${CODE[@]}" "${SKIP[@]}" "$@" 2>/dev/null | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -c1-220; }
gl() { grep -rlE "${CODE[@]}" "${SKIP[@]}" "$@" 2>/dev/null; }

# sec-no-tokens-in-browser
g '(localStorage|sessionStorage)\.(setItem|getItem)\([^)]*([Tt]oken|[Aa]ccess|[Rr]efresh|[Ss]ecret)' "${DIRS[@]}" | emit sec-no-tokens-in-browser
g 'document\.cookie[^;]*([Tt]oken|[Ss]ession)' "${DIRS[@]}" | emit sec-no-tokens-in-browser

# struct-server-only (modules under src/ and components/ that use server-side APIs without "server-only";
# pages, layouts, route handlers, "use server" files and tests are server-only by construction or not shipped)
for f in $(gl "from ['\"](next/headers|node:crypto|redis|ioredis|pino)['\"]|process\.env\.[A-Z_]*(SECRET|TOKEN|PASSWORD)" $(for d in src components; do [ -d "$d" ] && echo "$d"; done)); do
  case "$f" in *testkit*|*/testing.ts) continue ;; esac
  grep -qE "['\"]use server['\"]|['\"]server-only['\"]" "$f" || echo "$f:1: uses server-side APIs without import \"server-only\"" | emit struct-server-only
done

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
