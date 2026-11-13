---
title: cn() for conditional and overridable classes
impact: LOW
tags: tailwind, classes
check: review
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

**How to check:** look for `className` built with `+`, template strings or `.join(" ")` instead of `cn()`, and for `className` not passed last.
