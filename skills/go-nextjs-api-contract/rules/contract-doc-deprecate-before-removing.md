---
title: Nothing is removed or renamed without a deprecation first
impact: HIGH
tags: openapi, versioning, deprecation
check: review
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

**How to check:** in review, a document diff that removes or renames a field or operation not marked `deprecated: true` in an earlier release.
