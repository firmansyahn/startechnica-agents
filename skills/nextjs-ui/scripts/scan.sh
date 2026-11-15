#!/usr/bin/env bash
# scan.sh — read-only scan of a Next.js app for the nextjs-ui rules a script can detect (ui-theme-tokens-only, ui-one-primitives-folder, ui-base-ui-composition, ui-third-party-follows-mode, ui-focus-visible).
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

# ui-theme-tokens-only
PALETTE='(^|[ "'"'"'`:])(text|bg|border|ring|fill|stroke|from|via|to|outline|divide|placeholder|decoration|shadow|caret|accent)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]{2,3})?([/][0-9]+)?([ "'"'"'`]|$)'
g "$PALETTE" "${DIRS[@]}" --include='*.tsx' | emit ui-theme-tokens-only
g '[a-z]-\[(color:)?#[0-9a-fA-F]{3,8}\]|[a-z]-\[(rgba?|hsla?|oklch|oklab)\(' "${DIRS[@]}" | emit ui-theme-tokens-only

# ui-one-primitives-folder
g "from ['\"]@/components/ui(/|['\"])" "${DIRS[@]}" | emit ui-one-primitives-folder
[ -d components/ui ] && echo "components/ui: folder exists (use components/shadcn-ui)" | emit ui-one-primitives-folder

# ui-base-ui-composition
if grep -q '"@base-ui/react"' package.json 2>/dev/null; then
  g '[[:space:]]asChild([[:space:]=>]|$)' "${DIRS[@]}" | emit ui-base-ui-composition
  # Button and *Trigger parts default to nativeButton={true}; menu items and links don't need it.
  g '<(Button|[A-Za-z]*Trigger)[^>]*render=\{<(Link|a)[[:space:]>]' "${DIRS[@]}" | grep -v 'nativeButton' | emit ui-base-ui-composition
fi

# ui-third-party-follows-mode
g '<Toaster[^>]*theme=["'"'"']' "${DIRS[@]}" | emit ui-third-party-follows-mode
g 'hsl\(var\(--chart' "${DIRS[@]}" | emit ui-third-party-follows-mode

# ui-focus-visible: the outline removed with no focus-visible: replacement on the same line (the primitives keep theirs)
g '(^|[ "'"'"'`:])outline-(none|hidden)([ "'"'"'`]|$)' "${DIRS[@]}" --exclude-dir=shadcn-ui | grep -v 'focus-visible:' | emit ui-focus-visible
g 'outline[[:space:]]*:[[:space:]]*["'"'"']?(none|0)([^[:alnum:]]|$)' "${DIRS[@]}" --include='*.css' --exclude-dir=shadcn-ui | grep -v 'focus-visible' | emit ui-focus-visible

if [ ! -s "$OUT" ]; then echo "no findings"; exit 0; fi
sort -u "$OUT"
echo
echo "--- findings per rule (candidates: confirm against this skill's rules/<rule-id>.md) ---"
cut -f1 "$OUT" | sort | uniq -c | sort -rn
[ "$STRICT" -eq 1 ] && exit 1
exit 0
