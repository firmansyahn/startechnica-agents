---
title: Every page starts with the page title component
impact: LOW
tags: layout, pages
check: review
---

## Every page starts with the page title component

**Impact: LOW** (page heads don't line up and the document title doesn't match the page)

The shared page-title component (title, optional description, breadcrumb, primary action on the right) heads every page, so pages line up and the document title matches. No hand-built `h1` + button rows.

**Incorrect:**

```tsx
<div className="flex justify-between"><h1 className="text-2xl font-bold">Customers</h1><Button>Add</Button></div>
```

**Correct:**

```tsx
<PageTitle title={t("customers")} description={t("customersHint")} action={<ButtonWrite onClick={openCreate}>{t("addCustomer")}</ButtonWrite>} />
```

**How to check:** look for hand-built `h1` + button rows at the top of a page.
