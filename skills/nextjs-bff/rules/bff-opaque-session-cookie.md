---
title: The session cookie is opaque, HttpOnly, Secure and SameSite=Strict
impact: CRITICAL
tags: session
check: review
---

## The session cookie is opaque, HttpOnly, Secure and SameSite=Strict

**Impact: CRITICAL**

A random 32-byte id, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, no `Domain`, the `__Host-` prefix under https; no `Max-Age` when the session should end with the browser. Only the short-lived authorization-request cookie is `SameSite=Lax`, because the callback is a cross-site navigation.

**Incorrect:**

```ts
(await cookies()).set("session", JSON.stringify({ access, refresh }), { httpOnly: false });
```

**Correct:**

```ts
(await cookies()).set("__Host-session", randomId(32), { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
```
