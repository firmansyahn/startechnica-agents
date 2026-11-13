---
title: Fixtures fit the API spec
impact: MEDIUM
tags: testing
check: review
---

## Fixtures fit the API spec

**Impact: MEDIUM**

When the transport validates replies against the OpenAPI document, the fake's answers must pass it too: a create answers 201 with the whole row, a delete an empty body, a refusal the status with `{ message }` (plus `fields` for a 422). A fixture the real backend could never send proves nothing.
