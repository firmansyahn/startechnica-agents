---
title: The client component is named after the page
impact: MEDIUM
tags: pages
check: scan, review
---

## The client component is named after the page

**Impact: MEDIUM**

`ItemsClient.tsx`, `InvoiceClient.tsx`, `ItemDetailClient.tsx`, beside `page.tsx`. A generic `Client.tsx` or `PageContent.tsx` in every folder makes search, stack traces and tests unreadable.

**How to check:** `scripts/scan.sh` lists the generic names under `app/` (`Client.tsx`, `PageClient.tsx`, `ClientPage.tsx`, `PageContent.tsx`, `Content.tsx`, `Page.tsx`). Whether a specific name matches its page stays review.
