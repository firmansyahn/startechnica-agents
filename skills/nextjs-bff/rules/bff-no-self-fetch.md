---
title: Server Components don't fetch their own route handlers
impact: CRITICAL
tags: proxy
check: review
---

## Server Components don't fetch their own route handlers

**Impact: CRITICAL**

A Server Component calls the server function directly (the same forwarding the route handler uses). Fetching `/<area>/api/...` from the server adds an HTTP hop, needs an absolute URL, and fails at build time.
