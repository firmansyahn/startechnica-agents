---
title: Fixtures fit the API spec
impact: MEDIUM
tags: testing
check: test, review
---

## Fixtures fit the API spec

**Impact: MEDIUM**

When the transport validates replies against the OpenAPI document, the fake's answers must pass it too: a create answers 201 with the whole row, a delete an empty body, a refusal the status with `{ message }` (plus `fields` for a 422). A fixture the real backend could never send proves nothing.

**How to check:** the kit's `fakeApi` (`nextjs-new-app` assets/tests/render.tsx) takes a `validate` hook that runs on every reply before it is built. Wire it once, in the project's own wrapper of `fakeApi`, to the validator the transport uses (`src/api/validate.ts`, or a check against the OpenAPI document); it throws on a reply the real backend could never send, the reply becomes a 500, and `tests/setup-dom.ts` fails the test with the message, so a page that swallows the failed fetch can't hide it. Without a wired `validate` nothing is checked: that is a gap to report. Which replies the validator accepts is the validator's own test.
