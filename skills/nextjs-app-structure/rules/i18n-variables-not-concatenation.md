---
title: Messages carry variables, not concatenation
impact: MEDIUM
tags: strings
check: review
---

## Messages carry variables, not concatenation

**Impact: MEDIUM**

Word order differs between languages; plurals differ too.

**Incorrect:**

```tsx
{t("deleted") + " " + count + " " + t("customers")}
```

**Correct:**

```tsx
{t("deletedCustomers", { count })}   // "deletedCustomers": "{count, plural, one {Deleted # customer} other {Deleted # customers}}"
```
