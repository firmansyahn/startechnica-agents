---
title: The scope travels in one header
impact: HIGH
tags: tenancy, scope, headers
check: review
---

## The scope travels in one header

**Impact: HIGH** (a scope that moves between body, query and header gets dropped or spoofed somewhere)

The tenant/workspace is the shared scope header on every operation that takes it, never a body field on some endpoints and a query parameter on others. The server checks the caller may act in it.

**How to check:** in review, operations taking the tenant/workspace as a body field or query parameter instead of the shared header.
