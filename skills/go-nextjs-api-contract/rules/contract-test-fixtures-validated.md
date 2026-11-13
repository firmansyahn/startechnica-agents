---
title: Frontend fixtures pass the same reply check as production
impact: MEDIUM
tags: tests, fixtures, typescript
check: test
---

## Frontend fixtures pass the same reply check as production

**Impact: MEDIUM** (fixtures the real backend could never send make tests pass on broken code)

The test network fake runs every answer through the BFF's reply validator and fails on a mismatch. A fixture with `createdAt`, a missing `status`, or a bare row instead of the envelope fails the test that uses it.

**How to check:** the test network fake runs every answer through the BFF's reply validator.
