---
title: Every visible string comes from the message files
impact: MEDIUM
tags: strings
check: eslint, review
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

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports JSX text outside `t()` (`react/jsx-no-literals`; punctuation passes) and literal `aria-label`, `placeholder`, `title`, `alt`, `label` and `description` props and toast texts in `app/`, `components/` and `src/`; the shadcn primitives and tests are exempt. Strings in plain objects (column definitions, `confirm({ title })`, `metadata`) aren't seen, so review those. A page not translated yet carries a file-level disable comment with the reason until it is.
