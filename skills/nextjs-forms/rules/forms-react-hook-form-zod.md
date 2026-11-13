---
title: Build forms on react-hook-form with the shared zod schema
impact: MEDIUM
tags: forms, react-hook-form, zod
check: review
---

## Build forms on react-hook-form with the shared zod schema

**Impact: MEDIUM** (validation drifts between form and server; every field re-renders the whole page)

Form state lives in `useForm` with `zodResolver(schema)`, where `schema` is the one the server action also parses. No `useState` per field, no `setForm({ ...form, x })` handlers, no second hand-written validator.

**Incorrect:**

```tsx
const [form, setForm] = useState({ name: "", email: "" });
<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
if (!form.name) setError("Name is required");
```

**Correct:**

```tsx
const form = useForm<ItemInput, unknown, Item>({ resolver: zodResolver(itemSchema), defaultValues, mode: "onTouched" });
<Controller control={form.control} name="name" render={({ field, fieldState }) => (...)} />
```

**How to check:** look for `useState` objects named `form`/`values`/`data` updated from `onChange`, and for forms without `useForm`.
