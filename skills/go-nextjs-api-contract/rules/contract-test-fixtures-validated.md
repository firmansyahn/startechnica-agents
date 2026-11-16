---
title: Frontend fixtures pass the same reply check as production
impact: MEDIUM
tags: tests, fixtures, typescript
check: test
---

## Frontend fixtures pass the same reply check as production

**Impact: MEDIUM** (fixtures the real backend could never send make tests pass on broken code)

The test network fake runs every answer through the BFF's reply validator and fails on a mismatch. A fixture with `createdAt`, a missing `status`, or a bare row instead of the envelope fails the test that uses it.

**How to check:** the kit's `fakeApi` ([nextjs-new-app](../../nextjs-new-app/SKILL.md) assets/tests/render.tsx) calls its `validate` hook on every answer; the project wires the hook to the BFF's reply validator in its own wrapper, and `tests/setup-dom.ts` fails any test whose fixture the validator refuses. A `fakeApi` used without `validate` checks nothing.
