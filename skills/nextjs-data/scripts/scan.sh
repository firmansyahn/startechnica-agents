#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-data rules a script can detect (data-no-fetch-in-components,
# data-no-effect-fetch, action-use-server-exports, action-writes-only, sec-action-identity-from-session,
# data-scope-switch-clears-cache, data-test-fake-fetch, data-test-fresh-query-client).
# Prints one finding per line: <rule-id>\t<file>:<line> <text>, then a count per rule.
# Findings are candidates: confirm each against this skill's rules/<rule-id>.md before reporting it.
#
# Usage: bash scan.sh [app-root] [--strict]
#   app-root  the folder with the app's package.json (default .)
#   --strict  exit 1 when anything was found (for CI); default exit 0
# Env: SRC_DIRS="app components src" chooses the folders scanned for code (test files: these plus tests/).
#      SCOPE_SWITCH="onTenantSwitch|onScopeChange" names the project's scope-switch subscription.

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
# The same over Vitest test files only (SKIP leaves them out).
TDIRS=("${DIRS[@]}"); [ -d tests ] && TDIRS+=(tests)
gt() { grep -rnE --include='*.test.ts' --include='*.test.tsx' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git \
         --exclude-dir=dist --exclude-dir=build --exclude-dir=coverage "$@" 2>/dev/null \
       | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -c1-220; }

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
SERVER_FILES=()   # files with "use server" at the top, for the checks below
for f in $(gl "(^|[{;])[[:space:]]*['\"]use server['\"]" "${DIRS[@]}"); do
  first="$(grep -vE '^[[:space:]]*(//.*)?$' "$f" | head -1)"
  if printf '%s' "$first" | grep -qE "^[[:space:]]*['\"]use server['\"]"; then
    SERVER_FILES+=("$f")
    grep -nE '^export (const|let|var|class|enum|default [^a]|function )' "$f" | sed "s#^#$f:#" | emit action-use-server-exports
  else
    grep -nE "(^[[:space:]]+|[{;][[:space:]]*)['\"]use server['\"]" "$f" | sed "s#^#$f:#" | emit action-use-server-exports
  fi
done

# The modules the "use server" files import by a relative or @/ path (their input schemas).
SCHEMA_FILES=()
for f in ${SERVER_FILES[@]+"${SERVER_FILES[@]}"}; do
  d="$(dirname "$f")"
  for p in $(grep -oE "from[[:space:]]*['\"](\.\.?/|@/)[^'\"]+['\"]" "$f" | sed -E "s/^from[[:space:]]*['\"]//; s/['\"]$//"); do
    case "$p" in @/*) b="${p#@/}" ;; *) b="$d/${p#./}" ;; esac
    for c in "$b.ts" "$b.tsx" "$b/index.ts" "$b"; do [ -f "$c" ] && { SCHEMA_FILES+=("$c"); break; }; done
  done
done
for f in src/services/*/input.ts src/services/*/schema.ts; do [ -f "$f" ] && SCHEMA_FILES+=("$f"); done

if [ ${#SERVER_FILES[@]} -gt 0 ]; then
  # action-writes-only (uploads: a file in an action's input; actions are capped at 1 MB and can't stream)
  g -H 'z\.(file\(|instanceof\([[:space:]]*(File|Blob))|instanceof[[:space:]]+(File|Blob)([^[:alnum:]_]|$)' \
    "${SERVER_FILES[@]}" ${SCHEMA_FILES[@]+"${SCHEMA_FILES[@]}"} | emit action-writes-only
fi

# sec-action-identity-from-session (candidates: caller identity in an action's input; a role being written is fine)
ID_FILES=(${SERVER_FILES[@]+"${SERVER_FILES[@]}"} ${SCHEMA_FILES[@]+"${SCHEMA_FILES[@]}"})
if [ ${#ID_FILES[@]} -gt 0 ]; then
  g -H '(^|[^.[:alnum:]_])(actorId|actorRole|role|isAdmin|[[:alnum:]_]*[Tt]oken|sessionId|permissions)\??[[:space:]]*:' \
    "${ID_FILES[@]}" | emit sec-action-identity-from-session
fi

# data-scope-switch-clears-cache (the subscription belongs in the area's providers.tsx only)
SCOPE_SWITCH="${SCOPE_SWITCH:-onTenantSwitch|onScopeChange}"
g "(^|[^.[:alnum:]_])($SCOPE_SWITCH)\(" "${DIRS[@]}" --exclude='providers.tsx' \
  | grep -vE "function[[:space:]]+($SCOPE_SWITCH)" | emit data-scope-switch-clears-cache

# data-test-fake-fetch (tests mock the registry, the transport or an actions module instead of fetch)
gt "vi\.(do)?[Mm]ock\([[:space:]]*[\"'][^\"']*(services/|/actions[\"']|src/api/)" "${TDIRS[@]}" | emit data-test-fake-fetch

# data-test-fresh-query-client (a test builds its own client instead of rendering through the helper)
gt 'new QueryClient\(' "${TDIRS[@]}" | emit data-test-fresh-query-client

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
sort -u "$OUT" | cut -f1 | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
