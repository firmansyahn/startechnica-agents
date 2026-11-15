---
title: No manual dark: color overrides
impact: MEDIUM
tags: tailwind, themes, dark-mode
check: eslint
---

## No manual `dark:` color overrides

**Impact: MEDIUM** (the override hides a wrong token and breaks every preset but the one it was tuned for)

Tokens already change per mode. `dark:bg-...`/`dark:text-...` on top of a token means the token is wrong; fix or add the token instead.

**Incorrect:**

```tsx
<div className="bg-card dark:bg-neutral-900 text-foreground dark:text-white">
```

**Correct:**

```tsx
<div className="bg-card text-card-foreground">
```

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `dark:` color classes (`dark:bg-*`, `dark:text-*`, `dark:border-*` and the other color utilities, also after another variant) in `app/`, `components/` and `src/`; widths and shadow sizes pass, and the shadcn primitives are exempt. An override of third-party markup carries a disable comment with the reason.
