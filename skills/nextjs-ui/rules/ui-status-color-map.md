---
title: Status colors through one map of tokens
impact: MEDIUM
tags: tailwind, colors, status
check: review
---

## Status colors through one map of tokens

**Impact: MEDIUM** (status colors drift page by page and break in dark mode and presets)

Status chips, dots and badges read from one shared map whose values are token classes (`success`, `warning`, `info`, `destructive`, `muted`, `chart-N` for categories). Pages never pick a status color themselves.

**Incorrect:**

```tsx
<Badge className={status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
```

**Correct:**

```tsx
// src/libs/status-tone.ts
export const STATUS_TONE = {
  active: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  expired: "bg-muted text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
} as const;

<Badge className={STATUS_TONE[status] ?? STATUS_TONE.expired}>
```

**How to check:** look for palette or token color classes chosen inline next to a status value instead of a lookup in the shared map.
