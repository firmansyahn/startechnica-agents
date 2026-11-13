---
title: Show server field errors on their fields and keep the form open
impact: MEDIUM
tags: forms, errors, server-actions
check: test
---

## Show server field errors on their fields and keep the form open

**Impact: MEDIUM** (the user can't tell which field the server refused, or loses their input)

A 422 `Result` carries errors by field. Map them with `form.setError(field, { type: "server", message })`, focus the first, and send unknown keys and other refusals (403, 409, network) to a form-level notice. The form, drawer or dialog stays open on failure.

**Incorrect:**

```tsx
save.mutate(values, { onError: (e) => { toast.error(e.message); close(); } });
```

**Correct:**

```tsx
form.handleSubmit((v) => save.mutateAsync(v).then(close).catch((e) => applyServerErrors(form, e)))();
```

**How to check:** a test that answers the submit with a 422 and `fields`, asserting the message appears on that field, focus moves there and the form is still open.
