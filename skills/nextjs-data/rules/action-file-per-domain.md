---
title: Actions live in the domain's actions file, never inline in components
impact: HIGH
tags: actions
check: review
---

## Actions live in the domain's actions file, never inline in components

**Impact: HIGH**

`src/services/<domain>/actions.ts` (or `actions.ts` beside the one page that uses it). An inline `"use server"` function inside a component captures closure variables that Next encrypts and ships to the browser, and can't be tested on its own.

**Incorrect:**

```tsx
export default function Page({ id }: Props) {
  async function remove() { "use server"; await db.item.delete({ where: { id } }); }
  return <form action={remove}><Button type="submit">Delete</Button></form>;
}
```

**Correct:**

```tsx
<Button onClick={() => remove.mutate({ id, scope })}>{t("delete")}</Button>   // remove = useMutation over deleteItem
```
