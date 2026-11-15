#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-app-structure rules a script can detect (page-client-named-after-page, struct-private-folders-underscore, page-central-access-map).
# Prints one finding per line: <rule-id>\t<file>:<line> <text>, then a count per rule.
# Findings are candidates: confirm each against this skill's rules/<rule-id>.md before reporting it.
#
# Usage: bash scan.sh [app-root] [--strict]
#   app-root  the folder with the app's package.json (default .)
#   --strict  exit 1 when anything was found (for CI); default exit 0

set -u
ROOT="."; STRICT=0
for a in "$@"; do case "$a" in --strict) STRICT=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }

[ -d app ] || { echo "no app/ folder under $ROOT" >&2; exit 2; }

SKIP=(--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=dist --exclude-dir=build
      --exclude-dir=coverage --exclude-dir=playwright-report --exclude='*.test.ts' --exclude='*.test.tsx'
      --exclude='*.spec.ts' --exclude='*.spec.tsx' --exclude='*.gen.ts' --exclude='*.d.ts')
CODE=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs')
PRUNE=(-name node_modules -o -name .next -o -name .git -o -name dist -o -name build -o -name coverage)

OUT="$(mktemp)"; trap 'rm -f "$OUT"' EXIT
emit() { local id="$1"; while IFS= read -r line; do [ -n "$line" ] && printf '%s\t%s\n' "$id" "$line" >> "$OUT"; done; }
# grep lets the last matching --include/--exclude win, so the includes go first and the excludes after.
# Comment lines (// and JSDoc *) are dropped.
g() { grep -rnE "${CODE[@]}" "${SKIP[@]}" "$@" 2>/dev/null | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -c1-220; }
gl() { grep -rlE "${CODE[@]}" "${SKIP[@]}" "$@" 2>/dev/null; }
# f <find tests...>: paths under app/ matching the tests, with the build folders pruned.
f() { find app \( "${PRUNE[@]}" \) -prune -o "$@" -print 2>/dev/null; }

# page-client-named-after-page: a generic client component name (name it after the page: ItemsClient.tsx)
f -type f \( -name Client.tsx -o -name PageClient.tsx -o -name ClientPage.tsx -o -name PageContent.tsx -o -name Content.tsx -o -name Page.tsx \) \
  | sed 's/$/: generic name, call it <Page>Client.tsx/' | emit page-client-named-after-page

# struct-private-folders-underscore: a page-private folder without the underscore (it becomes a URL segment)
f -type d \( -name components -o -name shared -o -name hooks -o -name utils -o -name lib -o -name helpers \) \
  | sed 's/$/: private folder without the underscore (_name)/' | emit struct-private-folders-underscore
# ... and a page or route handler inside a _folder (the router ignores it, so it never becomes a URL)
f -type f \( -path '*/_*/page.tsx' -o -path '*/_*/page.jsx' -o -path '*/_*/route.ts' -o -path '*/_*/route.js' \) \
  | sed 's/$/: inside a _private folder, never routed (use a plain segment or a (group))/' | emit struct-private-folders-underscore

# page-central-access-map: a page checking roles itself instead of the route -> permission map
g '\.role[[:space:]]*[!=]==|(^|[^[:alnum:]_])roles?\.(includes|some|indexOf)\(' app | emit page-central-access-map

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
