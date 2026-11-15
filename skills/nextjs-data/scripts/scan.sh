#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-data rules a script can detect (data-no-fetch-in-components, data-no-effect-fetch, action-use-server-exports).
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

# data-no-fetch-in-components (route handlers excluded)
g '(^|[^.[:alnum:]_])fetch\(|axios' "${DIRS[@]}" --exclude='route.ts' --exclude='route.js' \
  | grep -vE '^(src/api|src/libs|src/services|proxy\.ts|middleware\.ts)' | emit data-no-fetch-in-components

# data-no-effect-fetch (candidates: files that both use useEffect and fetch/read/action calls)
for f in $(grep -rlE --include='*.tsx' "${SKIP[@]}" 'useEffect' "${DIRS[@]}" 2>/dev/null); do
  if grep -qE '(^|[^.[:alnum:]_])fetch\(|await (read|readPage|runAction)\(|\.then\(\(?res' "$f"; then
    grep -nE 'useEffect\(' "$f" | head -1 | sed "s#^#$f:#" | emit data-no-effect-fetch
  fi
done

# action-use-server-exports
# (a directive on its own line, or opening a one-line body: { "use server"; ... })
for f in $(gl "(^|[{;])[[:space:]]*['\"]use server['\"]" "${DIRS[@]}"); do
  first="$(grep -vE '^[[:space:]]*(//.*)?$' "$f" | head -1)"
  if printf '%s' "$first" | grep -qE "^[[:space:]]*['\"]use server['\"]"; then
    grep -nE '^export (const|let|var|class|enum|default [^a]|function )' "$f" | sed "s#^#$f:#" | emit action-use-server-exports
  else
    grep -nE "(^[[:space:]]+|[{;][[:space:]]*)['\"]use server['\"]" "$f" | sed "s#^#$f:#" | emit action-use-server-exports
  fi
done

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
