---
title: Label every control and mark invalid ones
impact: MEDIUM
tags: forms, accessibility
check: test
---

## Label every control and mark invalid ones

**Impact: MEDIUM** (screen readers announce unnamed fields; errors aren't announced)

Each control has a visible label linked by `htmlFor`/`id` (or an `aria-label` where the design has none), `aria-invalid` when its field has an error, and a `FieldError` (rendered with `role="alert"`). Placeholders are examples, not labels. The form has `noValidate`, so zod is the only validator.

**Incorrect:**

```tsx
<Input placeholder="Email" {...field} />
{fieldState.error && <span className="text-destructive">{fieldState.error.message}</span>}
```

**Correct:**

```tsx
<Field data-invalid={fieldState.invalid}>
  <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
  <Input id="email" type="email" autoComplete="email" {...field} aria-invalid={fieldState.invalid} />
  <FieldError errors={[fieldState.error]} />
</Field>
```

**How to check:** tests find every control with `getByLabelText`/`getByRole(..., { name })`; review controls without a `Field` wrapper.
