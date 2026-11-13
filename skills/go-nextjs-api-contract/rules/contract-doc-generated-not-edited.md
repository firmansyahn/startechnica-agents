---
title: Generated files are regenerated, never edited
impact: MEDIUM
tags: openapi, codegen
check: test
---

## Generated files are regenerated, never edited

**Impact: MEDIUM** (a hand edit is overwritten by the next generation and hides the real mismatch)

The document (when code-first), `schema.gen.ts` and the frontend's copy each start with a "generated, do not edit" header. A hand edit is overwritten by the next generation and hides the real mismatch.

**Incorrect:**

```ts
// src/api/schema.gen.ts
-        name: string;
+        name: string | null;   // "quick fix" for a reply that sent null
```

**Correct:**

```go
Note Opt[string] `json:"note"` // nullable in the Go type → regenerate the document → yarn gen:api
```

**How to check:** `yarn gen:api --check` and the backend document test fail when a generated file differs from its generator's output.
