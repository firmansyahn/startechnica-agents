---
title: Give every field a default value
impact: MEDIUM
tags: forms, react-hook-form
check: eslint, review
---

## Give every field a default value

**Impact: MEDIUM** (uncontrolled-to-controlled warnings, broken `isDirty`/`dirtyFields`, edits that PATCH everything)

`useForm` gets `defaultValues` for every field (`""`, `null`, `false`, `[]`). Edit forms reset to the loaded record once per record id, and again to the saved row after a successful save.

**Incorrect:**

```tsx
const form = useForm({ resolver: zodResolver(schema) });
useEffect(() => { if (data) form.reset(data); }, [data]);       // resets on every refetch
```

**Correct:**

```tsx
const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
useEffect(() => {
  if (data && seeded.current !== data.id) { form.reset(toFormValues(data)); seeded.current = data.id; }
}, [data, form]);
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags a `useForm(...)` call without `defaultValues` (options passed as a variable are skipped). Left to review: that `defaultValues` covers every field, and that resets are keyed on the record id.
