---
title: Keep tokens and secrets out of the browser
impact: CRITICAL
tags: bff, oauth, secrets, storage
check: scan
---

## Keep tokens and secrets out of the browser

**Impact: CRITICAL** (one XSS or a shared screenshot leaks a working credential)

Access and refresh tokens stay in the server-side session store; the browser holds an opaque `HttpOnly` cookie. Secrets never get a `NEXT_PUBLIC_` name (which bundles them into client JavaScript), and replies never carry a token.

**Incorrect:**

```ts
localStorage.setItem("accessToken", tokens.access);
fetch(api, { headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } });
// .env: NEXT_PUBLIC_CLIENT_SECRET=...
```

**Correct:**

```ts
// browser: credentials travel as the session cookie only
fetch("/app/api/items", { headers: { "x-app": "1" } });
// server: forwardAs(sessionId, (access) => callBackend(path, { headers: bearer(access) }))
```

**How to check:** `scripts/scan.sh` flags token words used with `localStorage`, `sessionStorage` or `document.cookie`; `nextjs-security`'s scan flags `NEXT_PUBLIC_` names containing `SECRET`, `TOKEN`, `PASSWORD` or `PRIVATE`. Review any reply type with `access`, `refresh` or `token` fields.
