---
title: One shared Failure response, referenced by every operation
impact: MEDIUM
tags: openapi, errors, envelope
check: test
---

## One shared Failure response, referenced by every operation

**Impact: MEDIUM** (refusals with ad hoc shapes escape the reply check and break `fromEnvelope`)

Every documented refusal (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `5xx`) points at one `components/responses/Failure` with the envelope schema, so the frontend's `fromEnvelope` has one shape to trust and the reply check covers refusals too.

**How to check:** the OpenAPI document test (`assets/openapi_rules_test.go`) fails any 4xx, 5xx or `default` response that isn't a `$ref` to `components/responses/Failure`.
