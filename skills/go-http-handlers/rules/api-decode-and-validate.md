---
title: Decode into a typed struct and validate it before use
impact: HIGH
tags: http-server, validation, json
check: review
---

## Decode into a typed struct and validate it before use

**Impact: HIGH** (unchecked input reaches the database and vendor calls: empty names, negative quotas, oversized strings, fields the client shouldn't set)

Each route decodes into its own input struct (not the stored entity, so clients can't set `id`, `tenant_id`, `created_at`), then validates it in one function that returns per-field errors for a 422. Refuse trailing data after the JSON value; refuse unknown fields where the API contract says so (`DisallowUnknownFields`), so typos don't silently do nothing. Path and query values are parsed and range-checked too.

**Incorrect:**

```go
var z Customer // the stored entity
_ = json.NewDecoder(r.Body).Decode(&z)
s.store.Create(ctx, z)
```

**Correct:**

```go
type createCustomerInput struct {
	Name     string `json:"name"`
	QuotaMiB int64  `json:"quota_mib"`
}

func (in createCustomerInput) validate() map[string]string {
	errs := map[string]string{}
	if n := strings.TrimSpace(in.Name); n == "" || len(n) > 100 {
		errs["name"] = "required, at most 100 characters"
	}
	if in.QuotaMiB < 0 {
		errs["quota_mib"] = "must be 0 or more"
	}
	return errs
}

dec := json.NewDecoder(r.Body)
dec.DisallowUnknownFields()
var in createCustomerInput
if err := dec.Decode(&in); err != nil || dec.More() {
	writeError(w, http.StatusBadRequest, "invalid JSON")
	return
}
if errs := in.validate(); len(errs) > 0 {
	writeFieldErrors(w, http.StatusUnprocessableEntity, errs)
	return
}
```

**How to check:** in review, every handler that reads a body or parameters: what type does it decode into, where is it validated, and can the client set a field it shouldn't?
