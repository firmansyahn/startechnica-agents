#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-security rules a script can detect (sec-no-public-secrets,
# tool-dependency-audit, deps-immutable-installs, deps-update-bot, sec-client-ip-from-trusted-proxy,
# sec-no-committed-env-values, sec-theme-script-csp).
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

# deps-immutable-installs: every install in CI and the image build is --immutable. Yarn 4 turns it on
# by itself when it detects CI, so the Dockerfile matters most; enableImmutableInstalls: false undoes it.
# The repo root relative to the app ("." or "../.."), so paths print short and each file once.
TOPR="$(git rev-parse --show-cdup 2>/dev/null)"; TOPR="${TOPR%/}"; TOPR="${TOPR:-.}"
BUILD=()
while IFS= read -r f; do BUILD+=("$f"); done < <( {
  find "$TOPR" -maxdepth 3 -type f \( -name '.gitlab-ci.yml' -o -name '*.gitlab-ci.yml' -o -path '*/.gitlab-ci/*.yml' \
    -o -path '*/.github/workflows/*.yml' -o -path '*/.github/workflows/*.yaml' \) -not -path '*/node_modules/*'
  find "$TOPR" -maxdepth 1 -type f \( -name 'Dockerfile*' -o -name 'Containerfile*' \)
  find . -maxdepth 2 -type f \( -name 'Dockerfile*' -o -name 'Containerfile*' \) -not -path './node_modules/*'
} 2>/dev/null | sort -u )
if [ ${#BUILD[@]} -gt 0 ]; then
  # A bare `yarn`, or `yarn install` (also through the committed release, yarn-*.cjs), without --immutable.
  grep -nE '((^|[[:space:]"'"'"'(;&|])yarn|/yarn-[^[:space:]/]*\.cjs)([[:space:]]+install([[:space:]]|$|[;&|)])|[[:space:]]*($|&&|;|\|\||\)))' "${BUILD[@]}" /dev/null 2>/dev/null \
    | grep -vE '^[^:]+:[0-9]+:[[:space:]]*#' | grep -v -- '--immutable' | cut -c1-220 | emit deps-immutable-installs
fi
for f in $(printf '%s\n' ./.yarnrc.yml "$TOPR/.yarnrc.yml" | sort -u); do
  [ -f "$f" ] && grep -nE '^enableImmutableInstalls:[[:space:]]*false' "$f" | sed "s#^#$f:#" | emit deps-immutable-installs
done

# deps-update-bot: a Renovate or Dependabot config at the repo root, and Renovate maintains the lockfile.
# A bot configured centrally (an organisation preset) shows as a false finding here.
BOT=""
for f in renovate.json renovate.json5 .renovaterc .renovaterc.json .renovaterc.json5 .github/renovate.json .github/renovate.json5 \
         .gitlab/renovate.json .gitlab/renovate.json5 .github/dependabot.yml .github/dependabot.yaml; do
  [ -f "$TOPR/$f" ] && { BOT="$TOPR/$f"; break; }
done
[ -z "$BOT" ] && [ -f "$TOPR/package.json" ] && grep -qE '"renovate"[[:space:]]*:[[:space:]]*\{' "$TOPR/package.json" && BOT="$TOPR/package.json"
if [ -z "$BOT" ]; then
  echo "$TOPR/renovate.json:1: no Renovate or Dependabot config at the repo root" | emit deps-update-bot
elif [ "${BOT#*dependabot}" = "$BOT" ]; then
  tr -d '\n' < "$BOT" | grep -qE 'lockFileMaintenance"?[[:space:]]*:[[:space:]]*\{[^}]*enabled"?[[:space:]]*:[[:space:]]*true|:maintainLockFilesWeekly|:maintainLockFilesMonthly' \
    || echo "$BOT:1: Renovate config without lockFileMaintenance enabled (transitive fixes never land)" | emit deps-update-bot
fi

# sec-client-ip-from-trusted-proxy: the left-most X-Forwarded-For value is whatever the client sent
g "[Xx]-[Ff]orwarded-[Ff]or['\"]\)?[^;]*\.split\([^)]*\)(\[0\]|\.shift\(\)|\.at\(0\))" "${DIRS[@]}" | emit sec-client-ip-from-trusted-proxy
g "(const|let|var)[[:space:]]*\[[[:space:]]*[A-Za-z_\$][A-Za-z0-9_\$]*[[:space:]]*\][^;]*[Xx]-[Ff]orwarded-[Ff]or" "${DIRS[@]}" | emit sec-client-ip-from-trusted-proxy

# sec-no-committed-env-values: no tracked .env* file but .env.example, and .env.local is ignored
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git ls-files -- '.env*' '*/.env*' 2>/dev/null | grep -vE '(^|/)\.env\.example$' | grep -v '/node_modules/' \
    | sed 's#$#:1: tracked by git; keep only .env.example (dummy values) and rotate any real value it held#' | emit sec-no-committed-env-values
  git check-ignore -q --no-index .env.local 2>/dev/null || echo ".gitignore:1: .env.local is not ignored (add .env* and !.env.example)" | emit sec-no-committed-env-values
fi

# sec-theme-script-csp (candidates): under a nonce CSP, a ThemeProvider or inline script given no nonce
if grep -qE 'nonce-|x-nonce' proxy.* middleware.* src/proxy.* src/middleware.* 2>/dev/null; then
  gl '<ThemeProvider([[:space:]>]|$)' "${DIRS[@]}" | while IFS= read -r f; do
    grep -q 'nonce=' "$f" || grep -nE '<ThemeProvider([[:space:]>]|$)' "$f" | sed "s#^#$f:#" | cut -c1-220 | emit sec-theme-script-csp
  done
  g '<script[[:space:]][^>]*dangerouslySetInnerHTML' "${DIRS[@]}" | grep -v 'nonce=' | emit sec-theme-script-csp
fi

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
