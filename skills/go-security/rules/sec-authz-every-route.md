---
title: Authorize every route and scope every query to the caller
impact: CRITICAL
tags: security, authorization, multi-tenant, idor
check: test
---

## Authorize every route and scope every query to the caller

**Impact: CRITICAL** (one tenant or user reads or changes another's data by changing an id)

Every route is registered with its permission in one place (the route table or a middleware that refuses routes without one), and the handler takes the caller and the tenant from the authenticated request, never from the body or query. Every query that loads a record by id also filters by the caller's scope, so a guessed id finds nothing.

**Incorrect:**

```go
mux.HandleFunc("DELETE /customers/{id}", h.deleteCustomer) // no permission declared

func (s *Store) DeleteCustomer(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `UPDATE customers SET deleted_at = now() WHERE id = $1`, id)
	return err
}
```

**Correct:**

```go
r.Handle("DELETE /customers/{id}", policy.Require("customers.write"), h.deleteCustomer)

func (s *Store) DeleteCustomer(ctx context.Context, tenantID, id string) error {
	tag, err := s.db.Exec(ctx,
		`UPDATE customers SET deleted_at = now() WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
		tenantID, id)
	if err != nil {
		return fmt.Errorf("delete customer %s: %w", id, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
```

**How to check:** a route test that walks the router's registered routes and fails on any without a declared permission (and on any public route not on an explicit list); handler tests that call with another tenant's id and expect 404. In review, follow each new query: does its `WHERE` carry the caller's scope?
