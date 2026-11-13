---
title: Callouts and form-level messages use the notice composite
impact: LOW
tags: composites, notices, forms
check: review
---

## Callouts and form-level messages use the notice composite

**Impact: LOW** (refusals and warnings look different on every page and miss the icon and tone)

Warnings, form-level refusals and explanatory callouts use the project's notice composite (tone + icon + text), not a styled `div` or a `p` in red.

**Incorrect:**

```tsx
<p className="text-destructive text-sm">{error}</p>
```

**Correct:**

```tsx
<Notice tone="destructive">{error}</Notice>
```

**How to check:** look for `<p className="text-destructive...">` or styled `div`s holding errors and warnings.
