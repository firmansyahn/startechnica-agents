---
title: No manual dark: color overrides
impact: MEDIUM
tags: tailwind, themes, dark-mode
check: review
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

**How to check:** search for `dark:bg-`, `dark:text-` and `dark:border-` on elements that already use a token class.
