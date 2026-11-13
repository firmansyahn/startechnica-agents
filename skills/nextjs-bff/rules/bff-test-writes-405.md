---
title: Write methods answer 405 unless allow-listed
impact: MEDIUM
tags: testing
check: review
---

## Write methods answer 405 unless allow-listed

**Impact: MEDIUM**

`PATCH`, `PUT`, `DELETE` and a `POST` to a non-upload path answer 405 with `Allow: GET, HEAD`; a `POST` to an allow-listed upload path is forwarded with its body streamed.
