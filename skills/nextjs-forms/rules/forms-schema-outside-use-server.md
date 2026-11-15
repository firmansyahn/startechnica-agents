---
title: The schema lives outside the "use server" file
impact: MEDIUM
tags: validation
check: test
---

## The schema lives outside the "use server" file

**Impact: MEDIUM**

`src/services/<domain>/input.ts` (or a page's `schema.ts`), imported by both sides. A `"use server"` file may export only async functions (`nextjs-data` Server actions rules).

**How to check:** the kit's `use-server-exports.test.ts` (from `nextjs-data`) fails on any export of a `"use server"` file that isn't an async function, so `export const itemInput = z.object(...)` there fails.
