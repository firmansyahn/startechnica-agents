#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-bff rules a script can detect (sec-no-tokens-in-browser,
# struct-server-only, bff-opaque-session-cookie, bff-store-keyed-by-hash, bff-refresh-ahead-and-on-401, bff-refresh-lock,
# bff-refuse-cross-site, bff-writes-405, bff-no-backend-error-leaks, bff-no-self-fetch, bff-request-id-forwarded,
# bff-rewrite-backend-paths, bff-test-matcher-prefixes, bff-validate-replies).
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

# The paths a check reads, of those that exist (an empty list skips the check: grep -r with no path reads ".").
have() { for p in "$@"; do [ -e "$p" ] && echo "$p"; done; }
# g and gl over the paths after the pattern; nothing when no path is left.
gin() { [ $# -gt 1 ] && g "$@"; }
glin() { [ $# -gt 1 ] && gl "$@"; }
API=$(have src/api)
NEXT_CONFIG=$(have next.config.js next.config.mjs next.config.cjs next.config.ts)
# Test files (the g/gl helpers skip them).
TESTS=(--include='*.test.ts' --include='*.test.tsx' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git)
# CI files of the app and of the repository it sits in.
TOP=$(git rev-parse --show-toplevel 2>/dev/null || echo .)
CI_FILES=$( { have .gitlab-ci.yml; [ "$TOP" != . ] && (cd "$TOP" && have .gitlab-ci.yml) | sed "s#^#$TOP/#";
  for d in .gitlab/ci .github/workflows "$TOP/.gitlab/ci" "$TOP/.github/workflows"; do [ -d "$d" ] && ls "$d"/*.yml "$d"/*.yaml 2>/dev/null; done; } | sort -u)

# bff-opaque-session-cookie (candidates: the authorization-request cookie is the one valid Lax)
g "httpOnly:[[:space:]]*false|sameSite:[[:space:]]*(false|[\"'](none|None|lax|Lax)[\"'])" "${DIRS[@]}" | emit bff-opaque-session-cookie

# bff-store-keyed-by-hash (candidates: a session store under src/api, and no sha256 anywhere there)
if [ -n "$API" ] && ! glin 'sha256|SHA-256' $API | grep -q .; then
  glin "from ['\"](ioredis|redis|@redis/client|@valkey/[a-z-]+|iovalkey)['\"]|new Map\(" $API | sed 's#$#:1: a store, and nothing under src/api hashes the cookie id (sha256)#' | emit bff-store-keyed-by-hash
fi

# bff-refresh-ahead-and-on-401 (candidates: a 401 handled without looking at WWW-Authenticate on the same line)
gin '\.status[[:space:]]*===?[[:space:]]*401' $API | grep -vi 'www-authenticate' | emit bff-refresh-ahead-and-on-401

# bff-refresh-lock (candidates: tokens refreshed under src/api, and no store lock (SET NX, Redlock) anywhere there)
if [ -n "$API" ] && ! glin "['\"]NX['\"]|NX:[[:space:]]*true|[Rr]edlock" $API | grep -q .; then
  for f in $(glin 'refresh_token' $API); do
    grep -n 'refresh_token' "$f" | head -1 | sed "s#^#$f:#;s#\$# (no SET NX lock under src/api)#" | emit bff-refresh-lock
  done
fi

# bff-refuse-cross-site (the BFF never grants CORS: no Access-Control-Allow-* header, no OPTIONS handler)
g 'Access-Control-Allow-(Origin|Methods|Headers|Credentials)|export[[:space:]]+(const|async[[:space:]]+function|function)[[:space:]]+OPTIONS\b|export[[:space:]]*\{[^}]*\bas[[:space:]]+OPTIONS\b' "${DIRS[@]}" $NEXT_CONFIG | emit bff-refuse-cross-site

# bff-writes-405 (the reads proxy's catch-all route exports no PUT, PATCH or DELETE; POST is for the upload allow-list)
if [ -d app ]; then
  find app -type f \( -name 'route.ts' -o -name 'route.js' \) 2>/dev/null | grep -E '/api/\[\[?\.\.\.[A-Za-z_]+\]\]?/route\.(ts|js)$' |
  while IFS= read -r f; do
    grep -nE 'export[[:space:]]+(const|async[[:space:]]+function|function)[[:space:]]+(PUT|PATCH|DELETE)\b|export[[:space:]]*\{[^}]*\bas[[:space:]]+(PUT|PATCH|DELETE)\b' "$f" | sed "s#^#$f:#" | emit bff-writes-405
  done
fi

# bff-no-backend-error-leaks (candidates: an error's message, stack or cause put into a reply)
gin '(NextResponse\.json|Response\.json|new Response)\([^)]*([^A-Za-z0-9_$.]|^)(err|error|e)\.(message|stack|cause)|(NextResponse\.json|Response\.json|new Response)\([^)]*String\((err|error|e)\)' $(have src/api app) | emit bff-no-backend-error-leaks

# bff-no-self-fetch (candidates in server helpers under src/, outside src/api: a fetch of the app's own /<area>/api/,
# of localhost, or of the request's Host; app/ and components/ are the kit ESLint's data-no-fetch-in-components)
if [ -d src ]; then
  for f in $(gl "['\"](server-only|use server)['\"]|from ['\"]next/headers['\"]" src | grep -v '^src/api/'); do
    grep -nE "fetch\([^)]*([\"'\`}]/[a-z0-9-]+/api/|localhost|127\.0\.0\.1|headers\(\)\)?\.get\([\"']host)" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*)' | sed "s#^#$f:#" | cut -c1-220 | emit bff-no-self-fetch
  done
fi

# bff-request-id-forwarded (candidates: a module under src/api that calls fetch and never sets x-request-id)
for f in $(glin 'fetch\(' $API); do
  grep -qi 'x-request-id' "$f" || grep -n 'fetch(' "$f" | head -1 | sed "s#^#$f:#;s#\$# (no x-request-id in this file)#" | cut -c1-220 | emit bff-request-id-forwarded
done

# bff-rewrite-backend-paths (next.config rewrites are fixed at build; on Next 16 and later the file is proxy.ts)
for f in $NEXT_CONFIG; do
  grep -nE 'rewrites[[:space:]]*(\(|:)' "$f" | grep -vE '^[0-9]+:[[:space:]]*//' | sed "s#^#$f:#;s#\$# (rewrite in proxy.ts, per request)#" | emit bff-rewrite-backend-paths
done
NEXT_MAJOR=$(grep -E '"next"[[:space:]]*:' package.json 2>/dev/null | head -1 | sed -E 's/.*"next"[[:space:]]*:[[:space:]]*"[^0-9]*([0-9]+).*/\1/')
case "$NEXT_MAJOR" in ''|*[!0-9]*) NEXT_MAJOR=0 ;; esac
if [ "$NEXT_MAJOR" -ge 16 ]; then
  for f in $(have middleware.ts middleware.js src/middleware.ts src/middleware.js); do
    echo "$f:1: Next $NEXT_MAJOR reads proxy.ts; rename it (the upgrade's middleware-to-proxy codemod)" | emit bff-rewrite-backend-paths
  done
fi

# bff-test-matcher-prefixes (proxy.ts exports a matcher and no test reads it)
for f in $(have proxy.ts middleware.ts src/proxy.ts src/middleware.ts); do
  grep -qE 'export[[:space:]]+const[[:space:]]+config' "$f" || continue
  grep -rlE "${TESTS[@]}" "config\.matcher|config\[[\"']matcher[\"']\]" . 2>/dev/null | grep -q . ||
    echo "$f:1: exports config.matcher, and no *.test.ts compares config.matcher with the prefix list" | emit bff-test-matcher-prefixes
done

# bff-validate-replies (candidates: hand-written reply types; the generated types not checked in CI)
gin '^(export[[:space:]]+)?(interface|type)[[:space:]]+[A-Za-z0-9]+(Response|Reply|Dto)\b' $(have src) | grep -v 'schema\.gen\.ts' | emit bff-validate-replies
if grep -qE '"gen:api"[[:space:]]*:' package.json 2>/dev/null; then
  { [ -n "$CI_FILES" ] && grep -lE 'gen:api[[:space:]]+--check' $CI_FILES 2>/dev/null; } | grep -q . ||
    grep -nE '"gen:api"[[:space:]]*:' package.json | head -1 | sed 's#^#package.json:#;s#$# (no CI file runs gen:api --check)#' | emit bff-validate-replies
fi

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
