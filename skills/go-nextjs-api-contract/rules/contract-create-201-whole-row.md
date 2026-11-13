---
title: A create answers 201 with the whole row
impact: MEDIUM
tags: create, status-codes, cache
check: test
---

## A create answers 201 with the whole row

**Impact: MEDIUM** (an id-only reply forces a second read and leaves server-set fields unknown)

The frontend puts the reply straight into the cache (`setQueryData`); a reply of just `{ "id": "..." }` forces a second read and leaves server-set fields (timestamps, defaults) unknown.

**How to check:** create handler tests assert 201 and that the reply passes the full row schema.
