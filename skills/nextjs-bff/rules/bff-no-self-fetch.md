---
title: Server Components don't fetch their own route handlers
impact: CRITICAL
tags: proxy
check: eslint, scan (candidates), review
---

## Server Components don't fetch their own route handlers

**Impact: CRITICAL**

A Server Component calls the server function directly (the same forwarding the route handler uses). Fetching `/<area>/api/...` from the server adds an HTTP hop, needs an absolute URL, and fails at build time.

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) already bans the `fetch` global and `axios` in `app/` and `components/` (route handlers excepted, rule `data-no-fetch-in-components`), so a Server Component there can't fetch its own route handler. `scripts/scan.sh` lists `fetch(` calls in server modules under `src/` outside `src/api/` (files with `import "server-only"`, `"use server"` or `next/headers`) whose URL is the app's own `/<area>/api/` path, `localhost`/`127.0.0.1` or the request's `host` header; browser-side wrappers are left alone, and a URL built in a variable is missed. Left to review: server helpers that build the URL elsewhere.
