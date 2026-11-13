---
title: Mark server code server-only
impact: HIGH
tags: structure, security, bundling
check: test
---

## Mark server code server-only

**Impact: HIGH** (session, token or secret-handling code bundled into client JavaScript)

Modules that read cookies, sessions, secrets or the backend directly (`src/api/*`, the logger, session store, config readers) start with `import "server-only"`, so importing them from a client component fails the build. Client code imports only types from them.

**Incorrect:**

```ts
// src/api/session.ts
export async function accessFor(id: string) { ... }       // importable from "use client" files
```

**Correct:**

```ts
// src/api/session.ts
import "server-only";
export async function accessFor(id: string) { ... }
```

**How to check:** `assets/tests/server-only.test.ts` fails on a module in `src/api/` (or another `SERVER_DIRS` folder) without `import "server-only"`, on a shared module that imports a server API (`next/headers`, `node:*`, Redis, a DB client, pino) without it, and on a `"use client"` file importing anything but types from `src/api/` (the shared `result.ts` excepted); `assets/eslint.config.mjs` refuses the same imports in client folders while typing. `scripts/scan.sh` flags candidates.
