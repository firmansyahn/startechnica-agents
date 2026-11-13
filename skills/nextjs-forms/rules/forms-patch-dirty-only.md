---
title: Send only changed fields when editing
impact: MEDIUM
tags: forms, patch, edit
check: test
---

## Send only changed fields when editing

**Impact: MEDIUM** (overwrites concurrent edits, trips backends that refuse unknown or read-only keys)

An edit form PATCHes the fields in `formState.dirtyFields`, and does nothing (or just closes) when nothing changed.

**Incorrect:**

```tsx
onSubmit={form.handleSubmit((values) => save.mutate({ id, changes: values }))}
```

**Correct:**

```tsx
onSubmit={form.handleSubmit((values) => {
  const changes = pickDirty(values, form.formState.dirtyFields);
  if (Object.keys(changes).length === 0) return close();
  return save.mutateAsync({ id, changes });
})}
```

**How to check:** an edit test that changes one field and asserts the request body contains only that field.
