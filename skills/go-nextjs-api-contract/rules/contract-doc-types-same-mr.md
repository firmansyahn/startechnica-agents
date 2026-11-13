---
title: The frontend copy and types change in the same merge request
impact: MEDIUM
tags: openapi, codegen, ci
check: test
---

## The frontend copy and types change in the same merge request

**Impact: MEDIUM** (a backend change without the frontend update breaks the next frontend build or deploy)

A backend change that alters the document also runs `yarn gen:api` and adapts the frontend in the same merge request (or, in separate repos, the frontend's update follows before the backend deploys). `yarn gen:api --check` in CI fails otherwise.

**How to check:** `yarn gen:api --check` in CI fails while the frontend copy or `schema.gen.ts` is behind the backend document.
