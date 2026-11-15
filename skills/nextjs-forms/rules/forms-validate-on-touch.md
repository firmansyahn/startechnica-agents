---
title: Validate on touch, and let zod be the only validator
impact: MEDIUM
tags: validation
check: eslint, review
---

## Validate on touch, and let zod be the only validator

**Impact: MEDIUM**

`mode: "onTouched"`: errors appear after the user leaves a field, then update as they type. `noValidate` on the `<form>`, so browser bubbles (`required`, `type="email"`) don't duplicate and contradict zod's messages.

**Incorrect:**

```tsx
<form onSubmit={onSubmit}>
  <Input type="email" required {...field} />
```

**Correct:**

```tsx
<form onSubmit={onSubmit} noValidate>
  <Input type="email" {...field} aria-invalid={fieldState.invalid} />
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags a `useForm(...)` call without `mode: "onTouched"` (options passed as a variable are skipped) and a `<form>` without `noValidate` (one with a spread is skipped). Left to review: validation rules passed to `register` or `Controller` instead of the schema.
