---
title: Wait for inputs with enabled, not with an early return
impact: HIGH
tags: queries
check: eslint (react-hooks/rules-of-hooks)
---

## Wait for inputs with enabled, not with an early return

**Impact: HIGH**

Hooks can't be called conditionally; gate the query with `enabled` and render the waiting state from `isPending`.

**Incorrect:**

```tsx
if (!scope) return null;
const list = useQuery(items.list(scope, params));
```

**Correct:**

```tsx
const list = useQuery({ ...items.list(scope, params), enabled: scope !== null });
```

**How to check:** `react-hooks/rules-of-hooks`, an error in eslint-config-next and so in the kit's config, reports a hook called after an early return.
