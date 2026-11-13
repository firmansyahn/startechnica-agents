---
title: Prefer ids over personal values; mask when a value is needed
impact: HIGH
tags: redaction
check: review
---

## Prefer ids over personal values; mask when a value is needed

**Impact: HIGH**

Log `account.id`, not the email. When support needs a value, mask it (`a***@example.com`, the last four digits of a phone number). Client IPs only where a security event needs them.
