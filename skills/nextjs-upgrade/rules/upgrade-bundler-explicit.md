---
title: Decide Turbopack or webpack when next.config has a webpack hook
impact: MEDIUM
tags: upgrade, next-16, turbopack, webpack
check: scan
---

## Decide Turbopack or webpack when next.config has a webpack hook

**Impact: MEDIUM** (Next 16 builds with Turbopack and fails when a webpack hook is found, often one a plugin added)

When `next.config` (or a plugin that wraps it) defines `webpack`, choose one of two:

- Move what the hook does to `turbopack` options (`rules`, `resolveAlias`) and delete the hook.
- Keep webpack with `--webpack` on `next build` (and `next dev` if needed), with a comment on why.

Don't pass `--turbopack` just to ignore the hook: the hook's work is then silently skipped.

**Incorrect:**

```ts
// next.config.mjs
webpack: (config) => { config.resolve.fallback = { fs: false }; return config; },
// package.json: "build": "next build --turbopack"
```

**Correct:**

```ts
// next.config.mjs
turbopack: { resolveAlias: { fs: { browser: "./src/libs/empty.ts" } } },
// package.json: "build": "next build"
```

**How to check:** `scripts/scan.sh` flags a `next.config.*` that mentions `webpack` while the `build` script has no `--webpack`.
