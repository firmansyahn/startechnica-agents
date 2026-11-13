---
title: CI fails when the document or the generated types are stale
impact: MEDIUM
tags: ci, codegen
check: test
---

## CI fails when the document or the generated types are stale

**Impact: MEDIUM** (a stale document or type file merges silently and breaks the next change)

Backend: the document test compares the route table's output with the committed file. Frontend: `yarn gen:api --check` compares the copy and `schema.gen.ts`, then `yarn tsc --noEmit` finds code using fields that changed. A stale file never merges.

**How to check:** CI runs the backend document test, `yarn gen:api --check` and `yarn tsc --noEmit`, none allowed to fail.
