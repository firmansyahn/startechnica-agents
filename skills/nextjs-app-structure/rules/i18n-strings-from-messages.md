---
title: Every visible string comes from the message files
impact: MEDIUM
tags: strings
check: review
---

## Every visible string comes from the message files

**Impact: MEDIUM**

Labels, buttons, headings, placeholders, toasts, empty states, `aria-label`s and dialog titles all come from `t("...")`. Strings in `src/messages/<locale>.json`, nowhere else.

**Incorrect:**

```tsx
<Button aria-label="Delete customer"><Trash2 /></Button>
```

**Correct:**

```tsx
<Button aria-label={t("deleteCustomer")}><Trash2 /></Button>
```
