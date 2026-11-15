---
title: One spelling for every name: snake_case on the wire and in the frontend
impact: MEDIUM
tags: naming, json, typescript
check: eslint, test, review
---

## One spelling for every name: snake_case on the wire and in the frontend

**Impact: MEDIUM** (a camelCase mapping layer doubles every name, breaks 422 paths and drifts)

JSON fields and query parameters are `snake_case`, and the frontend uses the generated types as they are. A camelCase mapping layer doubles every name, breaks 422 paths and drifts.

**Incorrect:**

```ts
const item = { id: row.id, createdAt: row.created_at, categoryId: row.category_id };
```

**Correct:**

```ts
const item: Item = row;                 // created_at, category_id, as the document says
```

**How to check:** The OpenAPI document test (`assets/openapi_rules_test.go`) fails a property or query parameter name that isn't snake_case. On the frontend, the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags a camelCase key copied from a snake_case field (`createdAt: row.created_at`). It misses renames through destructuring (`const { created_at: createdAt } = row`). Left to review: Go `json` tags that the document doesn't reach.
