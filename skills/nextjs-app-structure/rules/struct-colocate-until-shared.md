---
title: Keep code beside its one route until a second route needs it
impact: LOW
tags: structure, colocation
check: review
---

## Keep code beside its one route until a second route needs it

**Impact: LOW** (shared folders fill with single-use code; real shared code is hard to find)

A component, hook, helper, type or schema used by one route lives in that route's folder (or its section's `_shared/`). It moves to `components/` or `src/<kind>/` when a second route imports it.

**Incorrect:**

```
src/hooks/useInvoiceExportDialog.ts       // used only by app/billing/invoices/
components/InvoiceRow.tsx                 // used only by app/billing/invoices/
```

**Correct:**

```
app/billing/invoices/useExportDialog.ts
app/billing/invoices/InvoiceRow.tsx
```

**How to check:** for new files in `components/` and `src/`, count importing routes; one importer means it belongs beside that route.
