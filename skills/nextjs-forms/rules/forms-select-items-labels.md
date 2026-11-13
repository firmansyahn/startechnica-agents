---
title: Select shows labels through items
impact: MEDIUM
tags: fields
check: review
---

## Select shows labels through items

**Impact: MEDIUM**

Pass `items` to the Base UI `Select` so the trigger shows the option's label, not its raw value; map the empty string to `null` and back.

**Correct:**

```tsx
<Select items={customerItems} value={field.value || null} onValueChange={(v) => field.onChange(v ?? "")}>
```
