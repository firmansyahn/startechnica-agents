---
title: No real secrets or personal data in fixtures
impact: MEDIUM
tags: data-and-auth
check: review
---

## No real secrets or personal data in fixtures

**Impact: MEDIUM**

Test users and passwords come from CI variables; fixtures use `example.test` addresses and invented names. Saved auth state (`tests/e2e/.auth/`) is gitignored.
