---
title: Operation ids are stable names
impact: LOW
tags: openapi, naming
check: review
---

## Operation ids are stable names

**Impact: LOW** (renamed operation ids break generated clients and the frontend's `operations[...]` types)

`listItems`, `getItem`, `patchItem`: verb plus resource, set explicitly, never derived from the handler's Go name (which changes in refactors). Generated clients, docs and the frontend's `operations[...]` types key on them.

**How to check:** in review, an `operationId` change in the document diff, or one derived from a Go function name.
