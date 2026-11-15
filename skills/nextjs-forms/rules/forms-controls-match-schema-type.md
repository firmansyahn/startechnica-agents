---
title: Controls produce the schema's type
impact: MEDIUM
tags: fields
check: eslint, review
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags `z.coerce` anywhere in app code (a search-params parser that needs it takes a disable comment with the reason) and `{...field}` spread onto a `type="number"` element that has no `onChange` of its own. Left to review: date pickers and other controls whose value type the schema fixes.
