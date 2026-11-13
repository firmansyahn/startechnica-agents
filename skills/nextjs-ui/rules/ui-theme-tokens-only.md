---
title: Color with semantic tokens only
impact: MEDIUM
tags: tailwind, themes, colors
check: test
---

## Color with semantic tokens only

**Impact: MEDIUM** (the component looks right in one mode and breaks in the other; presets can't recolor it)

Use token utilities (`bg-card`, `text-muted-foreground`, `bg-primary text-primary-foreground`, `bg-success/10 text-success`, `chart-1..5`). No palette classes, arbitrary color values or inline color styles outside an explicit allow-list.

**Incorrect:**

```tsx
<div className="bg-white text-slate-500 border-gray-200">
<span className="text-[#1a2352]" style={{ color: "#f00" }}>
```

**Correct:**

```tsx
<div className="bg-card text-muted-foreground border-border">
<span className="text-primary">
```

**How to check:** `assets/tests/theme-tokens.test.ts` (palette, white/black, hex and color-function classes, an `ALLOWED` list of file + pattern + reason, and a stale-entry check); `assets/eslint.config.mjs` warns on the same classes while typing. `scripts/scan.sh` flags candidates.
