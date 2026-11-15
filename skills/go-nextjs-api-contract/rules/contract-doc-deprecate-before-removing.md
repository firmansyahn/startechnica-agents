---
title: Nothing is removed or renamed without a deprecation first
impact: HIGH
tags: openapi, versioning, deprecation
check: ci, review
---

## Nothing is removed or renamed without a deprecation first

**Impact: HIGH** (clients still on the old field or endpoint break, during a rolling deploy at the latest)

Add the new field or endpoint, mark the old one `deprecated: true` with a description naming the replacement and removal date, move the clients, then remove it. A first-party frontend that ships with its backend may shorten this to one release, but never to zero during a rolling deploy.

**Incorrect:**

```diff
-  "display_name": { "type": "string" }
+  "label": { "type": "string" }
```

**Correct:**

```json
"display_name": { "type": "string", "deprecated": true, "description": "Use label; removed after the next release" },
"label": { "type": "string" }
```

**How to check:** `assets/ci/openapi-breaking.sh <target-ref>` in the merge request pipeline runs `oasdiff breaking` on each `api/<surface>.openapi.json` against the target branch's copy. It fails on an operation, path, parameter or request property removed without `deprecated: true` in the base, on any removed response property (oasdiff can't see deprecation on an optional one), on a type change and on a deleted document. A break the team accepts gets a line in `api/breaking-ignore.txt`; in review, check that each new line names something deprecated in an earlier release.
