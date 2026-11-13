---
title: Mocked answers fit the API spec
impact: MEDIUM
tags: data-and-auth
check: review
---

## Mocked answers fit the API spec

**Impact: MEDIUM**

Fixtures come from typed builders over the generated API types (`item({ name })`), and the BFF's reply validation stays on. A fixture the real backend could never send makes the page fail in a way production never would, or pass when production fails.
