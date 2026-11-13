---
title: Apps never import each other
impact: LOW
tags: folders
check: review
---

## Apps never import each other

**Impact: LOW**

In a monorepo, code a second app needs moves to `packages/<name>/` and is imported by package name (`@acme/ui/button`), never by a relative path into another app or into a package's `src/`.
