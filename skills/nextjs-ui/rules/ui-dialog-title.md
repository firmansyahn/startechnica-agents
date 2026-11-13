---
title: Title every dialog and name every icon button
impact: MEDIUM
tags: accessibility, dialogs
check: test
---

## Title every dialog and name every icon button

**Impact: MEDIUM** (screen readers announce "dialog" or "button" with nothing else)

Every Dialog, AlertDialog and Sheet has a title (visually hidden if the design shows none) and a description where there's text. Every icon-only button has an `aria-label`.

**Incorrect:**

```tsx
<DialogContent><p>Delete this customer?</p>...</DialogContent>
<Button size="icon"><TrashIcon /></Button>
```

**Correct:**

```tsx
<DialogContent>
  <DialogTitle>{t("deleteCustomer")}</DialogTitle>
  <DialogDescription>{t("deleteCustomerHint")}</DialogDescription>
</DialogContent>
<Button size="icon" aria-label={t("delete")}><TrashIcon /></Button>
```

**How to check:** tests open dialogs and query `getByRole("dialog", { name })`; review `size="icon"` buttons without `aria-label`.
