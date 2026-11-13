---
title: Authorization is on the server, not in the UI
impact: HIGH
tags: actions
check: review
---

## Authorization is on the server, not in the UI

**Impact: HIGH**

Hiding or disabling a button is a convenience. The backend checks the permission on the forwarded call (BFF), or the action's data access layer checks ownership (`where: { id, ownerId: session.userId }`) when it talks to a database itself. The scope in the input is checked the same way.
