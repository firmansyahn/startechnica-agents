---
title: Filter soft-deleted rows in every query and join
impact: HIGH
tags: database, soft-delete, sql
check: review
---

## Filter soft-deleted rows in every query and join

**Impact: HIGH** (deleted records come back: in lists, in lookups by id, in joins that count or authorize, and in uniqueness checks)

On a table with `deleted_at`, every read filters `deleted_at IS NULL`, including each joined soft-delete table (in its `ON` clause, so a `LEFT JOIN` still works), updates (so a deleted row can't be edited), and the partial unique indexes (`WHERE deleted_at IS NULL`) that let a name be reused after delete.

**Incorrect:**

```sql
SELECT z.id, z.name, count(d.id)
FROM customers z
LEFT JOIN devices d ON d.customer_id = z.id
WHERE z.tenant_id = $1
GROUP BY z.id
```

**Correct:**

```sql
SELECT z.id, z.name, count(d.id)
FROM customers z
LEFT JOIN devices d ON d.customer_id = z.id AND d.deleted_at IS NULL
WHERE z.tenant_id = $1 AND z.deleted_at IS NULL
GROUP BY z.id
```

**How to check:** in review, for every changed query list its tables and check each soft-delete table has the filter. A database test that soft-deletes a row and expects it gone from every list and lookup catches the rest.
