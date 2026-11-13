---
title: Controls produce the schema's type
impact: MEDIUM
tags: fields
check: review
---

## Controls produce the schema's type

**Impact: MEDIUM**

A number field gives `number | null` for `z.number().nullable()`; a date picker gives the string or `Date` the schema declares. Convert in the control's binding, not with `z.coerce` (which makes the schema's input type `unknown`) and not in the action.

**Incorrect:**

```tsx
<Input type="number" {...field} />          // value arrives as a string
```

**Correct:**

```tsx
<Input type="number" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.valueAsNumber)} />
```
