---
title: Bind callback controls with Controller
impact: MEDIUM
tags: fields
check: review
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
