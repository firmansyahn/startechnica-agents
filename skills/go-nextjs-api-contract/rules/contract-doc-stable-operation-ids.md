---
title: Operation ids are stable names
impact: LOW
tags: openapi, naming
check: test, ci, review
---

## Operation ids are stable names

**Impact: LOW** (renamed operation ids break generated clients and the frontend's `operations[...]` types)

`listItems`, `getItem`, `patchItem`: verb plus resource, set explicitly, never derived from the handler's Go name (which changes in refactors). Generated clients, docs and the frontend's `operations[...]` types key on them.

**How to check:** `assets/openapi_rules_test.go` fails on an operation without an explicit `operationId`, one that isn't verb plus resource in lowerCamelCase, a duplicate, and (with `handlerNames` set from the route table) one equal to a handler's Go name. `assets/ci/openapi-breaking.sh` fails when an operation's `operationId` changed against the target branch. In review, without `handlerNames`: an id derived from a Go function name.
