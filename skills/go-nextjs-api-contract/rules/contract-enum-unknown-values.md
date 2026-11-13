---
title: Enums are listed strings, and clients render unknown values
impact: MEDIUM
tags: enums, typescript
check: review
---

## Enums are listed strings, and clients render unknown values

**Impact: MEDIUM** (a new enum value renders as `undefined` in a client without a fallback)

Lowercase `snake_case` strings with every value in the schema's `enum`; the generated TypeScript union covers them. Adding a value is additive only because every frontend `switch` or lookup has a fallback.

**Incorrect:**

```ts
const label = { active: t("active"), paused: t("paused") }[row.status]!;   // a new "archived" renders undefined
```

**Correct:**

```ts
const label = STATUS_KEYS[row.status] ? t(STATUS_KEYS[row.status]) : row.status;
```

**How to check:** in review, enum lookups or `switch`es over API values without a default branch.
