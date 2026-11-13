---
title: Export only async functions from "use server" files
impact: HIGH
tags: server-actions, build
check: test
---

## Export only async functions from "use server" files

**Impact: HIGH** (build errors, or schemas and constants accidentally exposed as action endpoints)

Every export of a `"use server"` file becomes a server action reference, so it must be an async function. Schemas, types and constants live in a sibling file (`input.ts`). No inline `"use server"` functions inside components: their closures are encrypted and shipped to the browser.

**Incorrect:**

```ts
"use server";
export const saveItemInput = z.object({ ... });
export const MAX = 10;
export async function saveItem(input: unknown) { ... }
```

**Correct:**

```ts
// input.ts
export const saveItemInput = z.object({ ... });
// actions.ts
"use server";
import { saveItemInput } from "./input";
export async function saveItem(input: unknown) { ... }
```

**How to check:** `assets/tests/use-server-exports.test.ts` fails on any export of a `"use server"` file that isn't an async function (consts, schemas, non-async functions, re-exports) and on an inline `"use server"` function. `scripts/scan.sh` flags the same shapes.
