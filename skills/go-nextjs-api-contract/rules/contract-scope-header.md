---
title: The scope travels in one header
impact: HIGH
tags: tenancy, scope, headers
check: test, scan (candidates), review
---

## The scope travels in one header

**Impact: HIGH** (a scope that moves between body, query and header gets dropped or spoofed somewhere)

The tenant/workspace is the shared scope header on every operation that takes it, never a body field on some endpoints and a query parameter on others. The server checks the caller may act in it.

**How to check:** `assets/openapi_rules_test.go` fails on a tenant/workspace query, path or cookie parameter or request-body field, on a scope header declared inline instead of the shared `components/parameters` entry, and on a second definition of it; a body field that names a *target* tenant goes in its allow-list with the reason. `scripts/scan.sh` lists handlers reading the tenant/workspace from `URL.Query()`, a form or `PathValue`. In review: that the server checks the caller may act in the scope.
