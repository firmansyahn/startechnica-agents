#!/usr/bin/env bash
# routes.sh — read-only list of a Next.js app's routes and the router serving each (nextjs-upgrade).
# Tracks a Pages Router to App Router move: every route is `pages`, `app`, or `both` (a conflict).
# Prints: <router>\t<route>\t<file(s)>, sorted by route, then a count per router.
#
# Usage: bash routes.sh [app-root] [--conflicts]
#   app-root     the folder with the app's package.json (default .)
#   --conflicts  print only the `both` lines (used by scan.sh)

set -u
ROOT="."; ONLY_CONFLICTS=0
for a in "$@"; do case "$a" in --conflicts) ONLY_CONFLICTS=1 ;; *) ROOT="$a" ;; esac; done
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
TAB="$(printf '\t')"

# pages/foo/index.tsx -> /foo ; pages/_app.tsx and other _files are not routes
list_pages() {
  for r in pages src/pages; do
    [ -d "$r" ] || continue
    find "$r" -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.jsx' -o -name '*.js' -o -name '*.mdx' \) ! -name '*.d.ts' |
    while IFS= read -r f; do
      case "$(basename "$f")" in _*) continue ;; esac
      p="${f#"$r"}"; p="${p%.*}"; p="${p%/index}"; [ -z "$p" ] && p="/"
      printf 'pages\t%s\t%s\n' "$p" "$f"
    done
  done
}

# app/(group)/customers/@slot/[id]/page.tsx -> /customers/[id] ; _private folders and intercepting routes skipped
list_app() {
  for r in app src/app; do
    [ -d "$r" ] || continue
    find "$r" -type f \( -name 'page.*' -o -name 'route.*' \) | grep -E '\.(tsx|ts|jsx|js|mdx)$' |
    while IFS= read -r f; do
      p="$(dirname "$f")"; p="${p#"$r"}"
      case "$p" in *'/(.)'*|*'/(..)'*|*'/(...)'*) continue ;; esac
      p="$(printf '%s' "$p" | sed -E 's#/\([^/]*\)##g; s#/@[^/]*##g')"
      case "$p" in */_*) continue ;; esac
      [ -z "$p" ] && p="/"
      printf 'app\t%s\t%s\n' "$p" "$f"
    done
  done
}

# Parameter names don't matter for a conflict: /customers/[id] and /customers/[slug] are the same path.
# (In the last class "[" comes last: "[." would start a collating symbol.)
key() { sed -E 's#\[\[\.\.\.[^]/]*\]\]#[[...]]#g; s#\[\.\.\.[^]/]*\]#[...]#g; s#\[[^]./[][^]/]*\]#[x]#g'; }

{ list_pages; list_app; } | while IFS="$TAB" read -r router route file; do
  printf '%s\t%s\t%s\t%s\n' "$(printf '%s' "$route" | key)" "$router" "$route" "$file"
done | sort | awk -F'\t' -v only="$ONLY_CONFLICTS" '
  { k = $1; if ($2 == "pages") P[k] = 1; else A[k] = 1; R[k] = $3; F[k] = (k in F) ? F[k] " " $4 : $4 }
  END {
    for (k in R) {
      s = (P[k] && A[k]) ? "both" : (P[k] ? "pages" : "app")
      if (only == 1 && s != "both") continue
      print s "\t" R[k] "\t" F[k]
      n[s]++
    }
    if (only != 1) {
      printf "\n--- routes per router: pages %d, app %d, both (conflict) %d ---\n", n["pages"] + 0, n["app"] + 0, n["both"] + 0
    }
  }' | { if [ "$ONLY_CONFLICTS" -eq 1 ]; then cat; else
          body="$(cat)"; printf '%s\n' "$body" | sed '/^$/,$d' | sort -t "$TAB" -k2,2; printf '%s\n' "$body" | sed -n '/^$/,$p'; fi; }
exit 0
