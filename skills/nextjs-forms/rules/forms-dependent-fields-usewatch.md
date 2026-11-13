---
title: Dependent fields read with useWatch and reset explicitly
impact: MEDIUM
tags: fields
check: review
---

## Dependent fields read with useWatch and reset explicitly

**Impact: MEDIUM**

Read the parent with `useWatch({ control, name })`, not `watch()` at the top of a large form (it re-renders everything). When the parent changes, reset the dependents (`setValue("subtype", "", { shouldDirty: true })`), and make the schema a discriminated union so hidden fields are neither validated nor sent.
