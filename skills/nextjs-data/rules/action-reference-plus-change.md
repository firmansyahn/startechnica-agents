---
title: Send a reference and the change, never a whole record
impact: HIGH
tags: actions
check: review
---

## Send a reference and the change, never a whole record

**Impact: HIGH**

The client names which record (an id) and what changes (the dirty fields); the server re-reads anything else. Accepting a whole record and writing it back lets the client set fields the form never showed (owner, status, price).
