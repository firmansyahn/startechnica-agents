---
title: Another scope's record is a 404, not a 403
impact: HIGH
tags: errors, authorization, tenancy
check: test
---

## Another scope's record is a 404, not a 403

**Impact: HIGH** (a 403 confirms the id exists, so ids in other scopes can be probed)

Looking up a record in a scope the caller can't see answers 404 "not found", exactly like a missing id, so ids can't be probed. 403 is for "you can see it, but may not do this to it".

**How to check:** a handler test reads another scope's record and asserts 404 with the same body as a missing id.
