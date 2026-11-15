---
title: Pass only serializable, non-secret data from a Server Component to a client one
impact: MEDIUM
tags: router, app-router, security
check: review
---

## Pass only serializable, non-secret data from a Server Component to a client one

**Impact: MEDIUM** (functions and class instances fail at render; whole records sent as props put internal fields and secrets in the page source)

Props crossing into a `"use client"` component are serialized into the HTML: plain objects, arrays, strings, numbers, booleans, `Date`, `Map`, `Set`, and promises. Pass what the client component shows, not the whole database or API record. A `getServerSideProps` that returned a trimmed object keeps returning it. Callbacks move into the client component, or become Server Actions.

**Incorrect:**

```tsx
const customer = await db.customer.findUnique({ where: { id } });   // includes apiKey, internal notes
return <CustomerPage customer={customer} onSave={saveCustomer} />;   // a function prop, and the whole row
```

**Correct:**

```tsx
const customer = await getCustomerView(id);   // { id, name, email, plan }
return <CustomerPage customer={customer} />;    // CustomerPage calls the saveCustomer Server Action itself
```

**How to check:** in review, read each prop a server page or layout passes to a client component: data only, and only the fields shown. Team stack: `nextjs-security` (DTOs, taint APIs).
