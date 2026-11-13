---
title: Bind OAuth state, nonce and PKCE to the browser and use them once
impact: CRITICAL
tags: oauth, sign-in, csrf
check: test
---

## Bind OAuth state, nonce and PKCE to the browser and use them once

**Impact: CRITICAL** (login CSRF, code injection or replayed callbacks)

Each sign-in attempt stores `state`, `nonce` and the PKCE verifier server-side behind a short-lived `HttpOnly` cookie. The callback takes (reads and deletes) that record, compares `state`, exchanges the code with the verifier, and validates the ID token's signature, `iss`, `aud`, `exp` and `nonce`.

**Incorrect:**

```ts
const state = searchParams.get("state");           // compared with nothing
const tokens = await exchange(code);               // no PKCE verifier, ID token unchecked
```

**Correct:**

```ts
const attempt = await store.takeAuth((await cookies()).get(AUTH_COOKIE)?.value);   // single use
if (!attempt || attempt.state !== params.state) return refused();
const tokens = await exchange(code, attempt.verifier);
await verifyIdToken(tokens.idToken, { issuer, audience: clientId, nonce: attempt.nonce });
```

**How to check:** tests for a missing cookie, a different state, a replayed callback and a wrong nonce, each refused before any token call.
