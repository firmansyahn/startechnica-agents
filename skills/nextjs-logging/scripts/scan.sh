#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-logging rules a script can detect (log-no-console,
# log-error-page-shows-digest, log-global-error-page, log-onrequesterror, log-redaction-test, log-silent-probes,
# log-source-maps-not-served).
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

# log-no-console
g '(^|[^.[:alnum:]_])console\.(log|info|warn|error|debug|trace)\(' "${DIRS[@]}" | emit log-no-console

# The App Router folders and the special files in them (error pages, probe routes).
APPDIRS=(); for d in app src/app; do [ -d "$d" ] && APPDIRS+=("$d"); done
CFG="$(ls next.config.* 2>/dev/null | head -n1)"
cfg() { [ -n "$CFG" ] && grep -nE "$1" "$CFG" | grep -vE '^[0-9]+:[[:space:]]*(//|\*)' | sed "s#^#$CFG:#" | cut -c1-220; }
appfiles() { [ ${#APPDIRS[@]} -eq 0 ] && return; find "${APPDIRS[@]}" -type f \( "$@" \) -not -path '*/node_modules/*' 2>/dev/null; }
LOGCALL='(^|[^.[:alnum:]_])(log|logger)\.'

# log-error-page-shows-digest: an error page renders error.message, or never shows error.digest
appfiles -name 'error.[jt]s' -o -name 'error.[jt]sx' -o -name 'global-error.[jt]s' -o -name 'global-error.[jt]sx' | while IFS= read -r f; do
  grep -nE '(^|[^.[:alnum:]_])(error|err)\.message' "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*)' | sed "s#^#$f:#" | cut -c1-220 | emit log-error-page-shows-digest
  grep -q 'digest' "$f" || echo "$f:1: shows no error.digest as the reference" | emit log-error-page-shows-digest
done

# log-global-error-page: the root app folder has global-error.*, and it renders <html> and <body>
if [ ${#APPDIRS[@]} -gt 0 ]; then
  GE="$(appfiles -name 'global-error.[jt]s' -o -name 'global-error.[jt]sx' | grep -E '^(src/)?app/global-error\.' | head -n1)"
  if [ -z "$GE" ]; then
    echo "${APPDIRS[0]}/:1: no global-error page (${APPDIRS[0]}/global-error.tsx)" | emit log-global-error-page
  else
    grep -q '<html' "$GE" || echo "$GE:1: renders no <html> of its own" | emit log-global-error-page
    grep -q '<body' "$GE" || echo "$GE:1: renders no <body> of its own" | emit log-global-error-page
  fi
fi

# log-onrequesterror: instrumentation exports onRequestError, and it logs the digest
if [ ${#APPDIRS[@]} -gt 0 ]; then
  INS="$(ls instrumentation.ts instrumentation.js src/instrumentation.ts src/instrumentation.js 2>/dev/null | head -n1)"
  ORE='export[[:space:]]+((const|let)[[:space:]]+onRequestError|(async[[:space:]]+)?function[[:space:]]+onRequestError)([^[:alnum:]_]|$)'
  if [ -z "$INS" ]; then
    echo "instrumentation.ts:1: no instrumentation file exporting onRequestError" | emit log-onrequesterror
  elif ! grep -qE "$ORE" "$INS"; then
    echo "$INS:1: exports no onRequestError" | emit log-onrequesterror
  elif ! grep -q 'digest' "$INS"; then
    grep -nE "$ORE" "$INS" | sed "s#^#$INS:#" | sed 's#$# (logs no digest)#' | cut -c1-220 | emit log-onrequesterror
  fi
fi

# log-redaction-test: the pino logger module exports its REDACT list or a createLogger factory, and a
# test (not excluded by SKIP, which drops tests) uses one of them and asserts values are absent
LOGMOD="$(gl "from[[:space:]]+['\"]pino['\"]" "${DIRS[@]}" | head -n1)"
if [ -n "$LOGMOD" ]; then
  grep -qE 'export[[:space:]]+((const|let)[[:space:]]+REDACT|(async[[:space:]]+)?function[[:space:]]+createLogger|const[[:space:]]+createLogger)([^[:alnum:]_]|$)|export[[:space:]]*\{[^}]*(REDACT|createLogger)' "$LOGMOD" \
    || echo "$LOGMOD:1: exports neither REDACT nor createLogger, so no test can use the real redaction" | emit log-redaction-test
  RT="$(grep -rlE --include='*.test.ts' --include='*.test.tsx' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git 'REDACT|createLogger\(' . 2>/dev/null \
        | while IFS= read -r t; do grep -qE 'not\.(toMatch|toContain)' "$t" && echo "$t"; done | head -n1)"
  [ -z "$RT" ] && echo "$LOGMOD:1: no redaction test (a *.test.ts using REDACT or createLogger( with not.toMatch/not.toContain)" | emit log-redaction-test
fi

# log-silent-probes: probe routes log nothing below warn
appfiles -name 'route.[jt]s' -o -name 'route.[jt]sx' | grep -E '/(livez|readyz|healthz|health)/' | while IFS= read -r f; do
  grep -nE "$LOGCALL(trace|debug|info)\(" "$f" | grep -vE '^[0-9]+:[[:space:]]*(//|\*)' | sed "s#^#$f:#" | cut -c1-220 | emit log-silent-probes
done

# log-source-maps-not-served: no public browser source maps, in the config or in a build output.
# Maps behind access control: put "log-source-maps-not-served" in a comment on that config line.
cfg 'productionBrowserSourceMaps[[:space:]]*:[[:space:]]*true' | grep -v 'log-source-maps-not-served' | emit log-source-maps-not-served
if [ -f .next/BUILD_ID ] && [ -d .next/static ]; then   # a production build (next dev writes no BUILD_ID)
  MAP="$(find .next/static -name '*.map' 2>/dev/null | head -n1)"
  [ -n "$MAP" ] && echo "$MAP:1: the build output has browser source maps ($(find .next/static -name '*.map' | wc -l | tr -d ' ') files); delete them after the upload" | emit log-source-maps-not-served
fi

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
