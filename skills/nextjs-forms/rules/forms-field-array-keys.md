---
title: Field arrays are keyed by field.id
impact: MEDIUM
tags: fields
check: review
---

## Field arrays are keyed by field.id

**Impact: MEDIUM**

`useFieldArray` rows render with `key={field.id}`, never the index: an index key moves typed values onto the wrong row when one is removed. Row controls use `` `rules.${index}.name` `` paths; array-level errors come from `errors.rules?.root`.

**Incorrect:**

```tsx
{fields.map((f, i) => <RuleRow key={i} index={i} />)}
```

**Correct:**

```tsx
{fields.map((f, i) => <RuleRow key={f.id} index={i} onRemove={() => remove(i)} />)}
```
