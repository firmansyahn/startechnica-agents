---
title: Write class names as complete literal strings
impact: MEDIUM
tags: tailwind, classes
check: eslint
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

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports a template literal in `className` or in `cn()`, `cva()` or `clsx()` whose text ends in `-` or `-[` before an interpolation, or starts with `-` or `]` after one. A class name built with a template string elsewhere (a lookup filled in a loop) isn't seen.
