#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-upgrade rules a script can detect.
# Prints one finding per line: <rule-id>\t<file>:<line> <text>, then a count per rule.
# Findings are candidates: confirm each against this skill's rules/<rule-id>.md before reporting it.
#
# Usage: bash scan.sh [app-root] [--strict]
#   app-root  the folder with the app's package.json (default .)
#   --strict  exit 1 when anything was found (for CI); default exit 0
# Env: SRC_DIRS="app pages components src lib hooks utils styles" chooses the folders scanned for code.

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f package.json ] || { echo "no package.json in $ROOT" >&2; exit 2; }

DIRS=()
for d in ${SRC_DIRS:-app pages components src lib hooks utils styles}; do [ -d "$d" ] && DIRS+=("$d"); done
for f in middleware.ts middleware.js proxy.ts proxy.js; do [ -f "$f" ] && DIRS+=("$f"); done
APPDIRS=()
for d in app src/app; do [ -d "$d" ] && APPDIRS+=("$d"); done
CFG="$(ls next.config.* 2>/dev/null | head -n1)"

SKIP=(--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=dist --exclude-dir=build
      --exclude-dir=coverage --exclude-dir=out --exclude='*.d.ts')
CODE=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs')

OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT
emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }
# Code grep over the source folders; comment-only lines are dropped unless the pattern is about comments.
g()  { [ ${#DIRS[@]} -eq 0 ] && return; grep -rnE "${CODE[@]}" "${SKIP[@]}" "$@" "${DIRS[@]}" 2>/dev/null | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -c1-220; }
gc() { [ ${#DIRS[@]} -eq 0 ] && return; grep -rnE "${CODE[@]}" "${SKIP[@]}" "$@" "${DIRS[@]}" 2>/dev/null | cut -c1-220; }
ga() { [ ${#APPDIRS[@]} -eq 0 ] && return; grep -rnE "${CODE[@]}" "${SKIP[@]}" "$@" "${APPDIRS[@]}" 2>/dev/null | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -c1-220; }
cfg() { [ -n "$CFG" ] && grep -nE "$1" "$CFG" | grep -vE '^[0-9]+:[[:space:]]*(//|\*)' | sed "s#^#$CFG:#" | cut -c1-220; }

# upgrade-codemod-leftovers
gc '@next-codemod-error|UnsafeUnwrapped|legacyBehavior' | emit upgrade-codemod-leftovers

# upgrade-node-everywhere
for f in .nvmrc .node-version; do
  [ -f "$f" ] && grep -nE '^v?(1[0-9]|[0-9])(\.|$)|^v?20\.[0-8]\.' "$f" | sed "s#^#$f:#" | emit upgrade-node-everywhere
done
# engines.node that allows a Node below 20 and names no 20+ major
grep -nE '"node"[[:space:]]*:[[:space:]]*"[^"]*"' package.json 2>/dev/null \
  | grep -E '(>=|\^|~|=|")[[:space:]]*v?(1[0-8]|[0-9])([.[:space:]x"]|$)' | grep -vE '(>=|\^|~)[[:space:]]*v?2[0-9]' \
  | sed 's#^#package.json:#' | emit upgrade-node-everywhere
for f in $(ls Dockerfile* */Dockerfile* .gitlab-ci.yml .github/workflows/*.yml 2>/dev/null); do
  grep -nE 'node:(1[0-9]|[0-9])([.-]|$|[[:space:]])|node-version:[[:space:]]*["'"'"']?(1[0-9])' "$f" | sed "s#^#$f:#" | cut -c1-220 | emit upgrade-node-everywhere
done

# upgrade-async-request-apis (App Router only)
ga '(cookies|headers|draftMode)\(\)\.' | emit upgrade-async-request-apis
ga '(params|searchParams)\??[[:space:]]*:[[:space:]]*\{' | emit upgrade-async-request-apis

# upgrade-edge-middleware-not-proxy
for f in proxy.ts proxy.js src/proxy.ts src/proxy.js; do
  [ -f "$f" ] && grep -nE 'runtime' "$f" | sed "s#^#$f:#" | emit upgrade-edge-middleware-not-proxy
done
for p in "" src/; do
  { [ -f "${p}proxy.ts" ] || [ -f "${p}proxy.js" ]; } && { [ -f "${p}middleware.ts" ] || [ -f "${p}middleware.js" ]; } \
    && echo "${p}middleware.*:1: middleware and proxy both exist" | emit upgrade-edge-middleware-not-proxy
done

# upgrade-removed-apis
grep -nE '"[^"]*"[[:space:]]*:[[:space:]]*"[^"]*next (lint|export)' package.json 2>/dev/null | sed 's#^#package.json:#' | emit upgrade-removed-apis
for f in $(ls .gitlab-ci.yml .github/workflows/*.yml Dockerfile* Makefile 2>/dev/null); do
  grep -nE 'next (lint|export)([[:space:]]|$)' "$f" | sed "s#^#$f:#" | emit upgrade-removed-apis
done
g "from ['\"](@next/font|next/config|next/amp|next/legacy/image)|require\(['\"](@next/font|next/config|next/amp)" | emit upgrade-removed-apis
g "useAmp\(|useFormState\(|experimental-edge|(req|request)\.(geo|ip)([^[:alnum:]_]|$)|unstable_(cacheLife|cacheTag)|experimental_ppr" | emit upgrade-removed-apis
g "import[[:space:]]*\{[^}]*ImageResponse[^}]*\}[[:space:]]*from[[:space:]]*['\"]next/server" | emit upgrade-removed-apis
g "revalidateTag\([^,()]+\)" | emit upgrade-removed-apis
cfg '(^|[^[:alnum:]_])(target|swcMinify|serverRuntimeConfig|publicRuntimeConfig|amp|domains|serverComponentsExternalPackages|bundlePagesExternals|dynamicIO|useCache|viewTransition|appNewScrollHandler|skipMiddlewareUrlNormalize)[[:space:]]*:' | emit upgrade-removed-apis
for f in $(find . -path ./node_modules -prune -o \( -name '*.scss' -o -name '*.sass' \) -print 2>/dev/null); do
  grep -nE "@(import|use|forward)[[:space:]]+['\"]~" "$f" | sed "s#^#${f#./}:#" | emit upgrade-removed-apis
done

# upgrade-parallel-route-default
for a in "${APPDIRS[@]}"; do
  find "$a" -type d -name '@*' 2>/dev/null | while IFS= read -r d; do
    has=0
    for ext in tsx ts jsx js; do [ -f "$d/default.$ext" ] && has=1; done
    [ "$has" -eq 0 ] && echo "$d:1: slot has no default file"
  done
done | emit upgrade-parallel-route-default

# upgrade-bundler-explicit
# A webpack hook with no --webpack on build; --turbopack on build would skip the hook's work silently.
if [ -n "$CFG" ] && grep -qE '(^|[^[:alnum:]_])webpack[[:space:]]*[:(]' "$CFG"; then
  grep -qE '"build"[[:space:]]*:[[:space:]]*"[^"]*--webpack' package.json \
    || cfg '(^|[^[:alnum:]_])webpack[[:space:]]*[:(]' | emit upgrade-bundler-explicit
  grep -nE '"build"[[:space:]]*:[[:space:]]*"[^"]*--turbo(pack)?' package.json | sed 's#^#package.json:#' | emit upgrade-bundler-explicit
fi

# upgrade-react-removals (React 18 and 19); tests included, since act and test-utils live there
gr() { [ ${#DIRS[@]} -eq 0 ] && return; grep -rnE "${CODE[@]}" --exclude-dir=node_modules --exclude-dir=.next --exclude='*.d.ts' "$@" "${DIRS[@]}" tests test __tests__ 2>/dev/null | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -c1-220; }
gr '\.(defaultProps|propTypes|contextTypes|childContextTypes)[[:space:]]*=|getChildContext\(|findDOMNode\(' | emit upgrade-react-removals
gr "ReactDOM\.(render|hydrate|unmountComponentAtNode)\(|import[[:space:]]*\{[^}]*(render|hydrate|unmountComponentAtNode)[[:space:]]*[,}][^}]*\}?[[:space:]]*from[[:space:]]*['\"]react-dom['\"]|react-dom/test-utils|react-test-renderer/shallow" | emit upgrade-react-removals
gr "[[:space:]]ref=['\"][^'\"]+['\"]|useRef\(\)|(^|[^.[:alnum:]_])JSX\.(Element|IntrinsicElements)" | emit upgrade-react-removals

# upgrade-image-defaults
if [ -z "$CFG" ] || ! grep -qE '(^|[^[:alnum:]_])qualities[[:space:]]*:' "$CFG"; then
  g 'quality=\{?["'"'"']?[0-9]+' | grep -vE 'quality=\{?["'"'"']?75([^0-9]|$)' | emit upgrade-image-defaults
fi
g "<Image[^>]*src=\{?['\"]/[^'\"]*\?" | emit upgrade-image-defaults
cfg "hostname[[:space:]]*:[[:space:]]*['\"](localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)|dangerouslyAllowLocalIP" | emit upgrade-image-defaults

# upgrade-no-new-defaults
cfg '(^|[^[:alnum:]_])(cacheComponents|partialPrefetching|ppr|reactCompiler)[[:space:]]*:' | emit upgrade-no-new-defaults

# The router checks below only apply once an app/ folder exists.
if [ ${#APPDIRS[@]} -gt 0 ]; then
  # router-one-router-per-path
  bash "$HERE/routes.sh" . --conflicts | awk -F'\t' '{ print $3 ":1: " $2 " is served by both routers" }' | emit router-one-router-per-path

  # router-no-pages-apis-in-app: Pages Router APIs under app/, and next/router in shared folders
  ga "from ['\"]next/(router|head)['\"]|require\(['\"]next/(router|head)['\"]\)" | emit router-no-pages-apis-in-app
  ga "(export[[:space:]]+(async[[:space:]]+)?function|export[[:space:]]+const)[[:space:]]+(getServerSideProps|getStaticProps|getStaticPaths)([^[:alnum:]_]|$)|\.getInitialProps[[:space:]]*=|\.getLayout[[:space:]]*=" | emit router-no-pages-apis-in-app
  ga "NextApiRequest|NextApiResponse|api[[:space:]]*:[[:space:]]*\{[[:space:]]*bodyParser" | emit router-no-pages-apis-in-app
  for d in components src/components hooks src/hooks lib src/lib; do
    [ -d "$d" ] && grep -rnE "${CODE[@]}" "${SKIP[@]}" "from ['\"]next/router['\"]" "$d" 2>/dev/null | cut -c1-220
  done | emit router-no-pages-apis-in-app

  # router-client-boundary: metadata exported from a "use client" file, and client-only code in files without the directive
  CLIENT_RE="^[[:space:]]*['\"]use client['\"]"
  grep -rlE "${CODE[@]}" "${SKIP[@]}" "$CLIENT_RE" "${APPDIRS[@]}" 2>/dev/null | while IFS= read -r f; do
    grep -nE 'export[[:space:]]+(const[[:space:]]+(metadata|viewport)|(async[[:space:]]+)?function[[:space:]]+generate(Metadata|StaticParams))' "$f" | sed "s#^#$f:#"
  done | cut -c1-220 | emit router-client-boundary
  grep -rLE "${CODE[@]}" "${SKIP[@]}" "$CLIENT_RE|^[[:space:]]*['\"]use server['\"]" "${APPDIRS[@]}" 2>/dev/null | grep -vE '/route\.(ts|js)$' | while IFS= read -r f; do
    grep -nE '(^|[^[:alnum:]_.])(useState|useEffect|useLayoutEffect|useReducer|useContext|createContext|useRouter|usePathname|useSearchParams)\(|[[:space:]]on[A-Z][a-zA-Z]+=\{|ssr:[[:space:]]*false' "$f" \
      | grep -vE '^[0-9]+:[[:space:]]*(//|\*)' | head -n 3 | sed "s#^#$f:#"
  done | cut -c1-220 | emit router-client-boundary
fi

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
