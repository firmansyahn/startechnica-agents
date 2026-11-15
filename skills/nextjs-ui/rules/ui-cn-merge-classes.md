---
title: cn() for conditional and overridable classes
impact: LOW
tags: tailwind, classes
check: eslint, review
---

## `cn()` for conditional and overridable classes

**Impact: LOW** (conflicting classes both apply, and the caller can't override the component's defaults)

Merge with `cn()` (clsx + tailwind-merge), with the caller's `className` last so it can override.

**Incorrect:**

```tsx
<div className={"rounded-md border " + (active ? "bg-accent" : "") + " " + className}>
```

**Correct:**

```tsx
<div className={cn("rounded-md border", active && "bg-accent", className)}>
```

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports a `className` built with `+`, with a template string that interpolates (next/font's `${font.variable}` classes pass), or with `.join()`. Whether the caller's `className` is passed last to `cn()` stays review.
