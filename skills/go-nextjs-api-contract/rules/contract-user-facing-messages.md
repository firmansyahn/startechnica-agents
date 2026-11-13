---
title: Refusal messages are for users
impact: MEDIUM
tags: errors, messages
check: review
---

## Refusal messages are for users

**Impact: MEDIUM** (the frontend shows the message as is, internal detail included)

A 4xx `message` is a sentence the frontend shows as is: what's wrong and, where possible, what to do. It never contains an internal id, a SQL fragment, a Go error chain or a stack.

**How to check:** in review, 4xx messages containing ids, SQL, Go error chains or wrapped `err.Error()` text.
