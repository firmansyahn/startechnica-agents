---
title: Imports use the aliases, not long relative paths
impact: LOW
tags: folders
check: review
---

## Imports use the aliases, not long relative paths

**Impact: LOW**

Shared code is imported through `@/hooks/...`, `@/services/...`, `@/components/...`; relative imports stay inside a route folder (`./CustomerDialog`). A `../../../src/utils/format` breaks on the next move.
