---
title: Field errors are a 422 keyed by the field's JSON path
impact: HIGH
tags: errors, 422, forms
check: test
---

## Field errors are a 422 keyed by the field's JSON path

**Impact: HIGH** (errors keyed any other way can't land on the form field that caused them)

Dotted paths with numeric array indexes (`address.city`, `rules.2.value`), the same names the form uses; `""` for an error not tied to a field. Never the Go struct field name, a column name or a message-only 422.

**Incorrect:**

```go
httpx.Fail(w, 422, "Rules[2].Value must be 1 to 65535", nil)
```

**Correct:**

```go
httpx.Fail(w, 422, "Check the highlighted fields", httpx.FieldErrors{"rules.2.value": {"Must be 1 to 65535"}})
```

```ts
// the form shows it under the third rule's value field (nextjs-forms applyServerErrors)
form.setError("rules.2.value", { type: "server", message: "Must be 1 to 65535" });
```

**How to check:** 422 handler tests assert the `errors` keys are the JSON paths the form uses (`rules.2.value`).
