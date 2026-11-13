---
title: Fixtures come from typed factories
impact: LOW
tags: tests, fixtures, typescript
check: review
---

## Fixtures come from typed factories

**Impact: LOW** (untyped fixture objects drift silently from the document)

**Incorrect:**

```ts
answer({ id: "1", name: "North" });                       // untyped; drifts silently
```

**Correct:**

```ts
// tests/fixtures/items.ts
export const item = (o: Partial<Item> = {}): Item => ({ id: "0190f3c2-0000-7000-8000-000000000001", name: "North", status: "active", created_at: "2026-11-13T07:15:05Z", ...o });
answer(item({ name: "South" }));
```

**How to check:** in review, inline fixture objects passed to the fake instead of factories typed with the generated types.
