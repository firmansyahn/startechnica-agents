---
title: Independent reads are separate queries
impact: HIGH
tags: queries
check: review
---

## Independent reads are separate queries

**Impact: HIGH**

Two unrelated reads are two `useQuery` calls (or `useQueries`), each with its own key, loading and error state. One `queryFn` doing `Promise.all` of unrelated reads caches them under one key and fails them together.
