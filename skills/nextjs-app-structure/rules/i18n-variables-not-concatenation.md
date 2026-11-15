---
title: Messages carry variables, not concatenation
impact: MEDIUM
tags: strings
check: eslint, review
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

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports a translation call (`t`, `tCommon`...) joined with `+` or placed in a template string. Translations set side by side in JSX (`{t("a")} {count} {t("b")}`) aren't reported; review those.
