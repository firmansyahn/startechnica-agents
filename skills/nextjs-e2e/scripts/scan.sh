#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-e2e rules a script can detect (test-e2e-no-fixed-waits,
# test-e2e-role-locators, e2e-check-headers-csp, e2e-flaky-is-failing, e2e-mock-where-requested, e2e-test-sign-in-not-in-prod).
# The config and CI checks (e2e-ci-production-build, e2e-health-route-ready, e2e-freeze-motion, e2e-keep-traces,
# e2e-image-matches-playwright, e2e-review-baseline-updates) are assets/tests/e2e-setup.test.ts.
# Prints one finding per line: <rule-id>\t<file>:<line> <text>, then a count per rule.
# Findings are candidates: confirm each against this skill's rules/<rule-id>.md before reporting it.
#
# Usage: bash scan.sh [app-root] [--strict]
#   app-root  the folder with the app's package.json (default .)
#   --strict  exit 1 when anything was found (for CI); default exit 0
# Env: SRC_DIRS="app components src" chooses the folders scanned for code;
#      E2E_FLAG=E2E_AUTH names the variable that turns on the test-only sign-in.

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

# test-e2e-no-fixed-waits, test-e2e-role-locators (Playwright specs)
SPEC=(--include='*.spec.ts' --include='*.spec.tsx' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git
      --exclude-dir=playwright-report --exclude-dir=test-results)
grep -rnE "${SPEC[@]}" 'waitForTimeout\(|networkidle' . 2>/dev/null | sed 's#^\./##' | cut -c1-220 | emit test-e2e-no-fixed-waits
grep -rnE "${SPEC[@]}" "\.locator\([\"'\`]([^\"'\`]*(\.[A-Za-z_-]|>|nth-child)|//|xpath=)" . 2>/dev/null | sed 's#^\./##' | cut -c1-220 | emit test-e2e-role-locators

# Specs and the e2e helpers next to them (fixtures, fake backends), comment lines dropped.
E2E=(--include='*.spec.ts' --include='*.spec.tsx' --include='*.setup.ts' --exclude-dir=node_modules --exclude-dir=.next
     --exclude-dir=.git --exclude-dir=playwright-report --exclude-dir=test-results)
e2e() {
  { grep -rnE "${E2E[@]}" "$@" . 2>/dev/null
    [ -d tests/e2e ] && grep -rnE --include='*.ts' --include='*.mjs' --exclude='*.spec.ts' --exclude='*.setup.ts' "$@" tests/e2e 2>/dev/null
  } | sed 's#^\./##' | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -c1-220
}
HAS_SPECS=$(grep -rlE "${SPEC[@]}" . . 2>/dev/null | head -1)
PW_CONFIG=$(for f in playwright.config.ts playwright.config.mts playwright.config.js playwright.config.mjs; do [ -f "$f" ] && echo "$f"; done | head -1)

# e2e-check-headers-csp (exact for presence: one spec asserts the CSP header and listens for CSP console messages)
if [ -n "$HAS_SPECS" ]; then
  both=""
  for f in $(grep -rliE "${SPEC[@]}" 'content-security-policy' . 2>/dev/null); do
    grep -qi 'content security policy' "$f" && both="$f" && break
  done
  [ -z "$both" ] && echo "(specs): no spec asserts the content-security-policy header and fails on \"Content Security Policy\" console messages (copy nextjs-security assets/e2e/security-headers.spec.ts)" | emit e2e-check-headers-csp
fi

# e2e-flaky-is-failing (failOnFlakyTests is exact; a quarantine without an issue link, and raised timeouts or retries, are candidates)
[ -n "$PW_CONFIG" ] && ! grep -qE '^[^/]*failOnFlakyTests' "$PW_CONFIG" && echo "$PW_CONFIG:1: no failOnFlakyTests (set failOnFlakyTests: CI)" | emit e2e-flaky-is-failing
e2e 'test(\.describe)?\.fixme\(' | grep -vE 'https?://' | emit e2e-flaky-is-failing
e2e 'test\.setTimeout\(|test\.slow\(|retries:[^,}]*([3-9]|[1-9][0-9])' | emit e2e-flaky-is-failing
[ -n "$PW_CONFIG" ] && grep -nE 'retries:[^,}]*([3-9]|[1-9][0-9])' "$PW_CONFIG" | grep -vE '^[0-9]+:[[:space:]]*//' | sed "s#^#$PW_CONFIG:#" | emit e2e-flaky-is-failing

# e2e-mock-where-requested (a server action or Flight reply forged in the browser: an RSC row, the RSC content type or headers)
e2e "route\.fulfill\([^)]*([\"'\`][0-9a-f]+:[\[{\"\$A-Z]|text/x-component)|[Nn]ext-[Aa]ction|[\"']RSC[\"']" | emit e2e-mock-where-requested

# e2e-test-sign-in-not-in-prod (code that reads the test sign-in flag, E2E_FLAG, and never mentions production)
for f in $(gl "process\.env(\.|\[[\"'])${E2E_FLAG:-E2E_AUTH}" "${DIRS[@]}"); do
  grep -q 'production' "$f" || grep -nE "${E2E_FLAG:-E2E_AUTH}" "$f" | head -1 | sed "s#^#$f:#;s#\$# (no production check in this file)#" | emit e2e-test-sign-in-not-in-prod
done

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
