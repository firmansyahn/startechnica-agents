#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-security rules a script can detect (sec-no-public-secrets, tool-dependency-audit).
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

# sec-no-public-secrets (publishable keys are meant to be public: confirm each hit)
grep -rnE 'NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PRIVATE|_KEY)' "${SKIP[@]}" . 2>/dev/null | grep -v '^./node_modules' | cut -c1-220 | emit sec-no-public-secrets
for f in $(ls next.config.* 2>/dev/null); do
  grep -nE '^[[:space:]]*env[[:space:]]*:' "$f" | sed "s#^#$f:#" | emit sec-no-public-secrets
done

# tool-dependency-audit (CI config lives at the repo root in a monorepo)
TOP="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
CI=(); for f in "$TOP"/.gitlab-ci.yml "$TOP"/.gitlab-ci/*.yml "$TOP"/.github/workflows/*.yml .gitlab-ci.yml; do [ -f "$f" ] && CI+=("$f"); done
if [ ${#CI[@]} -gt 0 ] && ! grep -qE 'npm audit' "${CI[@]}" 2>/dev/null; then
  echo "${CI[0]}:1: no 'yarn npm audit' step in the CI config" | emit tool-dependency-audit
fi
grep -nE 'npm audit' "${CI[@]}" /dev/null 2>/dev/null | grep -E 'allow_failure|continue-on-error|\|\| *true' | cut -c1-220 | emit tool-dependency-audit
[ -f .yarnrc.yml ] && awk '/^npmAuditIgnoreAdvisories:/{on=1;next} on&&/^[^[:space:]-]/{on=0} on&&/^[[:space:]]*-/&&!/#/{print ".yarnrc.yml:" NR ": ignored advisory without a reason: " $0}' .yarnrc.yml | emit tool-dependency-audit

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
