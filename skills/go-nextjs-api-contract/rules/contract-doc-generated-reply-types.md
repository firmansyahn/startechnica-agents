---
title: Reply types come from the document, never hand-written
impact: MEDIUM
tags: typescript, codegen
check: review
---

## Reply types come from the document, never hand-written

**Impact: MEDIUM** (hand-written reply types drift from what the API sends)

**Incorrect:**

```ts
interface Item { id: string; name: string; createdAt: string }   // drifted: the API sends created_at
```

**Correct:**

```ts
import type { components } from "@/src/api/schema.gen";
export type Item = components["schemas"]["Item"];
```

**How to check:** in review, any `interface`/`type` describing an API reply that isn't `components["schemas"][...]` from `schema.gen.ts`.
