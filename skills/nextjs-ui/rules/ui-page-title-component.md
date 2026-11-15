---
title: Every page starts with the page title component
impact: LOW
tags: layout, pages
check: eslint, review
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

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports an `h1` in `app/` (the page-title component in `components/` renders the page's one `h1`); error, not-found, forbidden and unauthorized pages and the kit's starter page are exempt, and a landing page is added to the config's `APP_OWN_HEADING` list. A hand-built title row without an `h1` stays review.
