---
title: URL state goes in searchParams, form state in react-hook-form
impact: MEDIUM
tags: client-state
check: review
---

## URL state goes in searchParams, form state in react-hook-form

**Impact: MEDIUM**

Filters, search, page, sort and the open tab belong in the URL so a reload or a shared link restores them. Values being edited belong to the form. A store for either duplicates a source of truth and loses state on reload.
