---
title: The fake checks requests against the document too
impact: LOW
tags: tests, fake, openapi
check: test
---

## The fake checks requests against the document too

**Impact: LOW** (a component sending wrong names or undeclared parameters passes its page test)

The method and path must exist, query parameters must be declared, and the body must pass the operation's request schema. A component that sends `categoryId` instead of `category_id` fails in its page test.

**How to check:** the test network fake validates method, path, query and body against the operation's request schema.
