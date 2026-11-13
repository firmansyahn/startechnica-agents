---
title: One spelling for every name: snake_case on the wire and in the frontend
impact: MEDIUM
tags: naming, json, typescript
check: review
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

**How to check:** in review, objects that rename API fields to camelCase, or camelCase properties in the document.
