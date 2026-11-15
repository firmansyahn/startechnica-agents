---
title: Bind callback controls with Controller
impact: MEDIUM
tags: fields
check: eslint, review
---

## Bind callback controls with Controller

**Impact: MEDIUM**

Base UI controls report values through callbacks (`onValueChange`, `onCheckedChange`). Bind them through `Controller`, mapping `field.value`/`field.onChange` onto their props, and wire `field.onBlur` to the trigger so `mode: "onTouched"` sees the field as touched. When a form mixes kinds, use `Controller` for every field so they all read the same way.

**Incorrect:**

```tsx
<Switch {...form.register("enabled")} />   // register passes onChange/value, which Switch doesn't use
```

**Correct:**

```tsx
<Controller control={form.control} name="enabled" render={({ field }) => (
  <Switch id="enabled" checked={field.value} onCheckedChange={field.onChange} />
)} />
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags `{...register(...)}` spread onto `Switch`, `Checkbox`, `Select`, `RadioGroup`, `Slider`, `Combobox` or `NumberField`. Left to review: `field.onBlur` wired to the trigger, a wrapper under another name, and `Controller` for every field in a mixed form.
