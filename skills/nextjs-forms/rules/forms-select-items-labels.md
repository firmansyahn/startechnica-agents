---
title: Select shows labels through items
impact: MEDIUM
tags: fields
check: eslint, review
---

## Select shows labels through items

**Impact: MEDIUM**

Pass `items` to the Base UI `Select` so the trigger shows the option's label, not its raw value; map the empty string to `null` and back.

**Correct:**

```tsx
<Select items={customerItems} value={field.value || null} onValueChange={(v) => field.onChange(v ?? "")}>
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags a `<Select>` in pages and components without an `items` prop (one with a spread is skipped). A `Select` from another library under the same name is flagged too and takes a disable comment. Left to review: the empty string mapped to `null` and back.
