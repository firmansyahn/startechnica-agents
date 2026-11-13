---
title: Keys are namespaced by route
impact: MEDIUM
tags: strings
check: review
---

## Keys are namespaced by route

**Impact: MEDIUM**

`<area>.<section>.<page>.<key>` (`admin.customers.list.title`), shared strings of a section under `<area>.<section>.common`, app-wide ones under `common`. A page calls `useTranslations("admin.customers.list")` once and uses short keys.
