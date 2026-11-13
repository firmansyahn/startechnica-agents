---
title: Handler tests check replies against the document
impact: MEDIUM
tags: tests, go, openapi
check: test
---

## Handler tests check replies against the document

**Impact: MEDIUM** (asserting a few fields proves only those fields, not the contract)

Asserting on a few fields proves those fields; validating the whole body against the operation's schema for its status proves the contract. One helper, called in every handler test.

**Incorrect:**

```go
if !strings.Contains(rec.Body.String(), `"name":"North"`) {
	t.Fatal("missing name")
}
```

**Correct:**

```go
contract.Check(t, doc, "PATCH", "/items/{id}", rec)   // declared status, envelope, schema
var got httpx.Envelope[Item]
decode(t, rec, &got)
if got.Data.Name != "North" {
	t.Fatalf("name = %q, want North", got.Data.Name)
}
```

**How to check:** every handler test calls the one contract-check helper; review handler tests that don't.
