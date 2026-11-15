---
title: Apps never import each other
impact: LOW
tags: folders
check: eslint
---

## Apps never import each other

**Impact: LOW**

In a monorepo, code a second app needs moves to `packages/<name>/` and is imported by package name (`@acme/ui/button`), never by a relative path into another app or into a package's `src/`.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports imports of a package's `src/` (`@acme/ui/src/...`) and, with `import/no-relative-packages`, relative imports into another folder that has its own `package.json`. A single app never trips it; a tsconfig path alias that points into another app isn't seen.
