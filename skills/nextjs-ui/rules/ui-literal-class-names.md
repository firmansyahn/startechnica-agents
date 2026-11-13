---
title: Write class names as complete literal strings
impact: MEDIUM
tags: tailwind, classes
check: review
---

## Write class names as complete literal strings

**Impact: MEDIUM** (Tailwind never generates the class; the style silently doesn't apply)

Tailwind scans source files for complete class names. Build variants from a lookup of full strings or `cva`, and merge with `cn()`; never interpolate parts of a class name.

**Incorrect:**

```tsx
<span className={`bg-${tone}-100 text-${tone}-700`} />
```

**Correct:**

```tsx
const TONE = { ok: "bg-success/10 text-success", bad: "bg-destructive/10 text-destructive" } as const;
<span className={cn("rounded px-2", TONE[tone], className)} />
```

**How to check:** look for template literals inside `className` that interpolate into a class name (`-${`, `${...}-`).
