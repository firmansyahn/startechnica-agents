---
title: Actions live in the domain's actions file, never inline in components
impact: HIGH
tags: actions
check: test, scan, review
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

**How to check:** the kit's `use-server-exports.test.ts` fails on an inline `"use server"` function, on its own line or opening a one-line body, and `scripts/scan.sh` lists the same shapes. Whether a `"use server"` file is the domain's `actions.ts` is left to review.
