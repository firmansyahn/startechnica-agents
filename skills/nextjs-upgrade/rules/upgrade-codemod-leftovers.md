---
title: Resolve every codemod marker before calling it done
impact: HIGH
tags: upgrade, codemods
check: scan
---

## Resolve every codemod marker before calling it done

**Impact: HIGH** (codemods mark what they could not transform; left in, the markers ship sync request-API casts and legacy links that break on the next major)

`next-async-request-api` leaves `@next-codemod-error` comments and `UnsafeUnwrapped*` casts where it couldn't make the code async. `new-link` adds `legacyBehavior` where it couldn't remove the `<a>`. Each one is unfinished work. Make the code async, or rewrite the link, and remove the marker.

**Incorrect:**

```ts
const store = cookies() as unknown as UnsafeUnwrappedCookies; // @next-codemod-error ...
const theme = store.get("theme")?.value;
```

**Correct:**

```ts
const store = await cookies();
const theme = store.get("theme")?.value;
```

**How to check:** `scripts/scan.sh` lists `@next-codemod-error`, `UnsafeUnwrapped` and `legacyBehavior` under `app/`, `pages/`, `components/` and `src/`.
