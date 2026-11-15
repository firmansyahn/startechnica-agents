---
title: Persist only per-device preferences, and hydrate after mount
impact: MEDIUM
tags: client-state
check: test, review (whether a value is a preference)
---

## Persist only per-device preferences, and hydrate after mount

**Impact: MEDIUM**

`persist` writes to `localStorage`: fine for table density or a dismissible hint, never for tokens, personal data or settings the server must apply. Use `skipHydration: true` and call `persist.rehydrate()` once in an effect, so the first client render matches the server's; give the store a `version` and `partialize` what is saved. A preference needed at server render (theme, locale) is a cookie.

**Incorrect:**

```ts
persist((set) => ({ accessToken: "", setToken: (t) => set({ accessToken: t }) }), { name: "auth" });
```

**Correct:**

```ts
persist((set) => ({ density: "comfortable", setDensity: (density) => set({ density }) }),
  { name: "<app>-prefs", version: 1, partialize: (s) => ({ density: s.density }), skipHydration: true });
```

Related: `sec-no-tokens-in-browser`.

**How to check:** `assets/tests/stores.test.ts` fails on a `persist(` from `zustand/middleware` whose options lack `skipHydration: true`, a `version` or a `partialize`, whose `partialize` spreads the state, or whose saved keys name a token, secret, password, session or email. It misses options built in a variable first. Whether each saved value is a per-device preference, and not one the server must apply, stays review.
