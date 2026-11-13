---
title: Put shared code in the src folder for its kind
impact: LOW
tags: structure, utils, hooks, libs
check: test
---

## Put shared code in the src folder for its kind

**Impact: LOW** ("pure" utils that fetch; hooks hidden in libs; duplicate top-level folders)

`src/utils` is pure (no React, network, browser or env), `src/hooks` holds hooks (`use*`), `src/libs` holds integration code, `src/api` is server-only, and no `src/` folder has a top-level twin (`hooks/` next to `src/hooks/`).

**Incorrect:**

```ts
// src/utils/currentUser.ts
export async function currentUser() { return (await fetch("/me")).json(); }
// src/libs/useDebounce.ts
```

**Correct:**

```ts
// src/libs/currentUser.ts   (integration)
// src/hooks/useDebounce.ts  (hook)
```

**How to check:** the layout test from `nextjs-app-structure/templates/src-layout.test.ts`.
