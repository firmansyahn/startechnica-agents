---
title: The client component is named after the page
impact: MEDIUM
tags: pages
check: review
---

## The client component is named after the page

**Impact: MEDIUM**

`ItemsClient.tsx`, `InvoiceClient.tsx`, `ItemDetailClient.tsx`, beside `page.tsx`. A generic `Client.tsx` or `PageContent.tsx` in every folder makes search, stack traces and tests unreadable.
