#!/usr/bin/env bash
# inventory.sh — read-only facts about a Next.js app before an upgrade or migration (nextjs-upgrade).
# Prints "key: value" lines: versions, routers, package manager, runtime pins, config features, middleware,
# custom server, Babel, lint and test setup, and the libraries that pin React or Next.
#
# Usage: bash inventory.sh [app-root]
#   app-root  the folder with the app's package.json (default .)
# Needs node on PATH (to read package.json).

set -u
ROOT="${1:-.}"
cd "$ROOT" || { echo "cannot cd to $ROOT" >&2; exit 2; }
[ -f package.json ] || { echo "no package.json in $ROOT" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 2; }

say() { printf '%s: %s\n' "$1" "$2"; }

# Declared and installed versions
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const installed = (n) => { try { return JSON.parse(fs.readFileSync(`node_modules/${n}/package.json`, "utf8")).version; } catch { return "-"; } };
for (const n of ["next", "react", "react-dom", "@types/react", "@types/react-dom", "typescript", "eslint", "eslint-config-next"]) {
  console.log(`version ${n}: declared ${all[n] || "-"}, installed ${installed(n)}`);
}
console.log(`engines.node: ${(pkg.engines && pkg.engines.node) || "-"}`);
console.log(`packageManager: ${pkg.packageManager || "-"}`);
const s = pkg.scripts || {};
for (const k of ["dev", "build", "start", "lint", "test", "export"]) if (s[k]) console.log(`script ${k}: ${s[k]}`);
const watch = ["next-auth", "@auth/core", "next-i18next", "next-intl", "next-translate", "react-intl", "swr", "@tanstack/react-query",
  "react-query", "redux", "@reduxjs/toolkit", "react-redux", "zustand", "mobx", "axios", "formik", "react-hook-form", "yup", "zod",
  "styled-components", "@emotion/react", "@mui/material", "@chakra-ui/react", "antd", "bootstrap", "react-bootstrap", "tailwindcss",
  "@radix-ui/react-slot", "@base-ui/react", "@base-ui-components/react", "winston", "pino", "@sentry/nextjs", "next-pwa", "next-seo",
  "next-sitemap", "@next/font", "jest", "vitest", "cypress", "@playwright/test", "@storybook/react", "@vercel/analytics"];
const found = watch.filter((n) => all[n]).map((n) => `${n}@${all[n]}`);
console.log(`libraries: ${found.length ? found.join(", ") : "-"}`);
'

# Runtime
say "node (this shell)" "$(node -v)"
for f in .nvmrc .node-version; do [ -f "$f" ] && say "$f" "$(head -n1 "$f")"; done
for f in $(ls Dockerfile* */Dockerfile* 2>/dev/null); do
  grep -nE '^[[:space:]]*FROM[[:space:]]+node:' "$f" | sed "s#^#$f:#" | while IFS= read -r l; do say "docker" "$l"; done
done
for f in $(ls .gitlab-ci.yml .github/workflows/*.yml 2>/dev/null); do
  grep -nE 'image:.*node:|node-version:' "$f" | sed "s#^#$f:#" | while IFS= read -r l; do say "ci" "$l"; done
done

# Package manager
pm=""
[ -f yarn.lock ] && pm="$pm yarn"
[ -f package-lock.json ] && pm="$pm npm"
[ -f pnpm-lock.yaml ] && pm="$pm pnpm"
{ [ -f bun.lock ] || [ -f bun.lockb ]; } && pm="$pm bun"
say "lockfiles" "${pm:- none (check the workspace root)}"
[ -f .yarnrc.yml ] && say "yarnPath" "$(grep -E '^yarnPath' .yarnrc.yml || echo '-')"

# Routers
for r in pages src/pages; do [ -d "$r" ] && say "pages router" "$r ($(find "$r" -type f \( -name '*.tsx' -o -name '*.ts' -o -name '*.jsx' -o -name '*.js' \) | wc -l | tr -d ' ') files)"; done
for r in app src/app; do [ -d "$r" ] && say "app router" "$r ($(find "$r" -type f \( -name 'page.tsx' -o -name 'page.jsx' -o -name 'page.js' -o -name 'page.ts' \) | wc -l | tr -d ' ') pages)"; done

# Config
cfg="$(ls next.config.* 2>/dev/null | head -n1)"
if [ -n "$cfg" ]; then
  say "next.config" "$cfg"
  for k in webpack turbopack experimental i18n images domains remotePatterns rewrites redirects headers output target swcMinify \
           serverRuntimeConfig publicRuntimeConfig amp basePath trailingSlash compiler transpilePackages cacheComponents reactCompiler; do
    grep -qE "(^|[^[:alnum:]_])$k([^[:alnum:]_]|$)" "$cfg" && printf '  uses %s\n' "$k"
  done
  grep -nE 'require\(|^import ' "$cfg" | grep -vE "['\"]next['\"]|next/" | sed 's/^/  plugin? /'
else
  say "next.config" "none"
fi

# Middleware, proxy, custom server, Babel
for f in middleware.ts middleware.js src/middleware.ts src/middleware.js proxy.ts proxy.js src/proxy.ts src/proxy.js; do
  [ -f "$f" ] && say "edge/proxy file" "$f$(grep -qE 'runtime' "$f" && echo ' (sets runtime)')"
done
find pages src/pages -name '_middleware.*' 2>/dev/null | while IFS= read -r f; do say "nested _middleware (12.0/12.1)" "$f"; done
for f in server.js server.ts server.mjs; do [ -f "$f" ] && grep -qE "require\(['\"]next['\"]\)|from ['\"]next['\"]" "$f" && say "custom server" "$f"; done
for f in .babelrc .babelrc.js babel.config.js babel.config.json; do [ -f "$f" ] && say "babel" "$f"; done

# Lint and tests
for f in .eslintrc .eslintrc.js .eslintrc.cjs .eslintrc.json .eslintrc.yml eslint.config.js eslint.config.mjs eslint.config.ts; do [ -f "$f" ] && say "eslint config" "$f"; done
for f in jest.config.js jest.config.ts vitest.config.ts vitest.config.mts cypress.config.ts cypress.config.js playwright.config.ts; do [ -f "$f" ] && say "test config" "$f"; done

# Parallel route slots, Sass
find app src/app -type d -name '@*' 2>/dev/null | while IFS= read -r d; do say "parallel slot" "$d"; done
n_scss="$(find . -path ./node_modules -prune -o \( -name '*.scss' -o -name '*.sass' \) -print 2>/dev/null | wc -l | tr -d ' ')"
[ "$n_scss" != "0" ] && say "sass files" "$n_scss"
exit 0
