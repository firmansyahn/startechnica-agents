---
title: A drawer keeps its form open on failure and ignores close while pending
impact: MEDIUM
tags: edit-forms
check: review
---

## A drawer keeps its form open on failure and ignores close while pending

**Impact: MEDIUM**

Create/edit lives in the project's form drawer or dialog composite. On failure it stays open with the errors shown; on success it closes and the list updates through the mutation's cache work. While pending it ignores Escape and outside presses so the outcome isn't lost. When Save sits in the drawer footer outside the `<form>`, it is `type="submit"` with `form="<form-id>"`.

**Incorrect:**

```tsx
<Button onClick={() => { onSubmit(); setOpen(false); }}>{t("save")}</Button>   // closes before the result
```

**Correct:**

```tsx
<Button type="submit" form="item-form" disabled={save.isPending}>{t("save")}</Button>
// onSubmit: save.mutateAsync(...).then(() => setOpen(false)).catch((e) => applyServerErrors(form, e))
```
