---
title: Data access is server-only and checks the caller
impact: HIGH
tags: data
check: review
---

## Data access is server-only and checks the caller

**Impact: HIGH**

The Data Access Layer (or `src/api/` in a BFF) starts with `import "server-only"`, reads the caller from the session, and checks access in the query itself (`where: { id, ownerId }`). A page that fetches a record by id without a caller check is an IDOR.

Related: `struct-server-only`.
