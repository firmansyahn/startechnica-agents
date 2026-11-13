---
title: Surface versions are for redesigns, not for one field
impact: LOW
tags: openapi, versioning
check: review
---

## Surface versions are for redesigns, not for one field

**Impact: LOW** (a new major surface for one field doubles the API for every client)

`/api/v1/` → `/api/v2/` when the surface's shape changes as a whole (envelope, auth, naming). One renamed field is a deprecation inside v1.

**How to check:** in review, a new `/api/v<n>/` surface whose only change is a field rename or addition.
