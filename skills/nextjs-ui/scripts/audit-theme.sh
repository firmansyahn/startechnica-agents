#!/usr/bin/env bash
# audit-theme.sh — read-only theming inventory + gap scan for a shadcn/Tailwind-v4 app.
# Run from the repo root. Reports counts + locations; never edits anything.
# Pairs with references/theme-audit-checklist.md (the mechanical part of the gap-hunt).
#
# Usage: bash audit-theme.sh [root]   (default root = .)

set -u
ROOT="${1:-.}"
cd "$ROOT" || { echo "cannot cd to $ROOT"; exit 1; }

# Prefer ripgrep; fall back to grep -r.
if command -v rg >/dev/null 2>&1; then
  SEARCH() { rg --no-messages "$@"; }
  COUNT()  { rg --no-messages -c "$@" 2>/dev/null | awk -F: '{s+=$NF} END{print s+0}'; }
  FILES()  { rg --no-messages -l "$@" 2>/dev/null; }
else
  # grep fallback: callers pass the pattern then the paths (default "."); skip dependency and
  # build folders, which make a recursive grep take minutes.
  GREP_SKIP=(--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=dist
             --exclude-dir=build --exclude-dir=coverage --exclude-dir=playwright-report)
  _paths() { [ "$#" -gt 0 ] && printf '%s\n' "$@" || echo .; }
  SEARCH() { local p="$1"; shift; mapfile -t P < <(_paths "$@"); grep -rEn "${GREP_SKIP[@]}" -- "$p" "${P[@]}" 2>/dev/null; }
  COUNT()  { local p="$1"; shift; mapfile -t P < <(_paths "$@"); grep -rEoh "${GREP_SKIP[@]}" -- "$p" "${P[@]}" 2>/dev/null | wc -l | tr -d ' '; }
  FILES()  { local p="$1"; shift; mapfile -t P < <(_paths "$@"); grep -rElE "${GREP_SKIP[@]}" -- "$p" "${P[@]}" 2>/dev/null; }
fi

UI="${UI_DIR:-app components src}"   # dirs to scan; override with UI_DIR="app components"

hr() { printf '\n=== %s ===\n' "$1"; }

hr "STACK DETECTION"
GLOBALS="$(FILES '@import "tailwindcss"' 2>/dev/null | head -1)"
[ -z "$GLOBALS" ] && GLOBALS="$(find . -name globals.css -not -path '*/node_modules/*' 2>/dev/null | head -1)"
echo "globals.css:        ${GLOBALS:-NOT FOUND}"
echo -n "tailwind v4 (@theme):   "; grep -qE '^@theme' "$GLOBALS" 2>/dev/null && echo yes || echo "no/unknown"
echo -n "@theme inline present:  "; grep -qE '@theme inline' "$GLOBALS" 2>/dev/null && echo yes || echo "NO (preset switching needs this)"
echo -n "next-themes installed:  "; grep -q '"next-themes"' package.json 2>/dev/null && echo yes || echo "NO"
UI_ALIAS="$(grep -oE '"ui"[[:space:]]*:[[:space:]]*"[^"]+"' components.json 2>/dev/null | sed -E 's/.*"([^"]+)"$/\1/')"
echo -n "shadcn ui dir:          "
if [ -n "$UI_ALIAS" ]; then echo "$UI_ALIAS (components.json)"; elif [ -d components/shadcn-ui ]; then echo "components/shadcn-ui"; elif [ -d components/ui ]; then echo "components/ui (team convention: components/shadcn-ui)"; else echo "not found"; fi

hr "MIGRATION SURFACE (hardcoded color)"
echo -n "hex literals (#rgb/#rrggbb), occurrences: "
COUNT '#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b' $UI
echo "files with hex (top 30):"
FILES '#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b' $UI 2>/dev/null | grep -vE 'globals\.css' | head -30
echo -n "tailwind literal-color utils (gray/slate/zinc/neutral/stone), occurrences: "
COUNT '\b(bg|text|border|ring|from|to|via|fill|stroke)-(gray|slate|zinc|neutral|stone)-[0-9]{2,3}' $UI

hr "CHART BUG (hsl wrapping OKLCH tokens)"
echo "hsl(var(--chart  occurrences (should be 0 if tokens are OKLCH):"
SEARCH 'hsl\(var\(--chart' $UI 2>/dev/null | head -20
echo "(if found AND tokens are oklch() in globals.css → replace with bare var(--chart-N))"

hr "TOASTER theme= override (sonner)"
SEARCH 'Toaster[^>]*theme=' $UI 2>/dev/null | head -10
echo "(a hardcoded theme=\"light\" here beats useTheme() — remove it)"

hr "DEAD / DUPLICATE TOKENS (inspect globals.css manually)"
echo "demo tokens (midnight/tahiti/bermuda):"
SEARCH 'midnight|tahiti|bermuda' "$GLOBALS" 2>/dev/null | head
echo "candidate duplicate ramps/palettes (repeated custom prefixes) in globals.css:"
grep -oE '\-\-[a-z0-9]+-[a-z0-9-]+' "$GLOBALS" 2>/dev/null | sed -E 's/-[0-9]+$//' | sort | uniq -c | sort -rn | head -20

hr "AUTHORED-BUT-UNUSED SURFACE TOKENS"
for tok in sidebar navbar; do
  decl=$(grep -cE "\-\-$tok" "$GLOBALS" 2>/dev/null)
  use=$(COUNT "\b(bg|text|border|ring)-$tok" $UI)
  echo "--$tok*: declared lines in globals=$decl, utility uses in code=$use  $([ "$use" = "0" ] && echo '<-- DEAD if 0' )"
done

hr "CONFIG / SESSION / LAYOUT (locate per-repo specifics)"
echo "env theme reads (THEME_* / process.env.*theme*):"
SEARCH 'THEME_[A-Z_]+|process\.env\.[A-Za-z]*[Tt]heme' app src 2>/dev/null | head -10
echo "session API (getSession / iron-session / cookies):"
FILES 'getSession|iron-session|cookies\(\)' app src libs 2>/dev/null | head -10
echo "root layout:"
find app -maxdepth 1 -name 'layout.tsx' 2>/dev/null
echo "chrome components:"
FILES 'bg-navbar|bg-sidebar|navbar-foreground' components 2>/dev/null | head

hr "EXISTING [data-theme] / [data-font] BLOCKS"
echo -n "[data-theme=...] selectors in globals: "; grep -coE '\[data-theme=' "$GLOBALS" 2>/dev/null
echo -n "[data-font=...] selectors in globals:  "; grep -coE '\[data-font=' "$GLOBALS" 2>/dev/null
echo "preset names found:"; grep -oE '\[data-theme="[^"]+"\]' "$GLOBALS" 2>/dev/null | sort -u

printf '\n--- done. cross-check findings against references/theme-audit-checklist.md ---\n'
