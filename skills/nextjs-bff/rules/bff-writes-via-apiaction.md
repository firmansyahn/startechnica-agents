---
title: Writes go through apiAction and return a Result
impact: CRITICAL
tags: proxy
check: eslint, test, review
---

## Writes go through apiAction and return a Result

**Impact: CRITICAL**

Server actions call the shared `apiAction(method, path, opts)`: the session from `headers()`, the same forwarding and refresh, the reply converted with `fromEnvelope` into a `Result`, backend unavailability as a 503 `Result`. No action builds its own `fetch` to the backend (`nextjs-data` Server actions rules).

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) bans the `fetch` global and `axios` imports in `src/services/**/actions.ts`, and `nextjs-data`'s `assets/tests/use-server-exports.test.ts` fails any `"use server"` file that calls `fetch(`. Typing `apiAction` as `Promise<Result<T>>` leaves the type checker to catch an action that doesn't return a `Result`. Left to review: another HTTP client, or a helper module that an action calls and that fetches.
