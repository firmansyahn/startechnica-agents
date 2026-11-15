---
title: Give every parallel route slot a default file
impact: HIGH
tags: upgrade, next-16, app-router, parallel-routes
check: scan
---

## Give every parallel route slot a default file

**Impact: HIGH** (Next 16 fails the build when a slot has no default.js)

Each `@slot` folder in `app/` needs a `default.tsx` (or `.js`) since Next 16. To keep the old behaviour, it returns `null`, or calls `notFound()` where the slot must not render on a hard navigation.

**Incorrect:**

```text
app/customers/@drawer/[id]/page.tsx
app/customers/layout.tsx          # renders {drawer}
```

**Correct:**

```text
app/customers/@drawer/[id]/page.tsx
app/customers/@drawer/default.tsx # export default function Default() { return null; }
app/customers/layout.tsx
```

**How to check:** `scripts/scan.sh` lists every `@*` folder under `app/` with no `default.(tsx|ts|jsx|js)`.
