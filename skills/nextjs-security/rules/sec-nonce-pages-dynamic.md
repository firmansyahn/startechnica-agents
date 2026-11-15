---
title: Nonce pages render dynamically
impact: HIGH
tags: headers
check: ci
---

## Nonce pages render dynamically

**Impact: HIGH**

A statically generated page has no request and no nonce, so its scripts are blocked. Under a nonce policy, pages are dynamic (signed-in pages usually are; others call `await connection()`). If pages must stay static and cached, use SRI instead of nonces.

**How to check:** `assets/ci/security.gitlab-ci.yml` job `<app>:nonce-pages-dynamic` runs `next build` and then `assets/ci/prerendered-pages.mjs`: when `proxy.ts` (or `middleware.ts`) sets a nonce, it fails on every page `.next/prerender-manifest.json` lists as prerendered, except the framework's own `/_not-found` and `/_global-error` and the pages in its `ALLOWED` list (static on purpose, with SRI), which fails when stale. Re-check the manifest's shape after a Next major upgrade.
