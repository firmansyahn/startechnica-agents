---
title: Browser reports carry no form values or tokens
impact: HIGH
tags: redaction
check: review
---

## Browser reports carry no form values or tokens

**Impact: HIGH**

A client error report holds message, stack, digest, route, build id and request id; never form values, tokens, or URLs with query strings. An error tracker runs with its PII scrubbing on.
