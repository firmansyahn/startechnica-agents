---
title: The session cookie is opaque, HttpOnly, Secure and SameSite=Strict
impact: CRITICAL
tags: session
check: test, scan (candidates), review
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

**How to check:** a sign-in callback test: the session cookie's `Set-Cookie` matches `^__Host-[^=]+=[A-Za-z0-9_-]{43};` (32 random bytes in base64url) and has `HttpOnly`, `Secure`, `SameSite=Strict` and `Path=/`, with no `Domain` and no `Max-Age`; only the authorization-request cookie is `SameSite=Lax`. `scripts/scan.sh` lists `httpOnly: false` and a `sameSite` of `none`, `lax` or `false` in the app's code; the authorization-request cookie is the one valid Lax hit.
