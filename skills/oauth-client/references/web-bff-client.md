# Web app as a confidential client (BFF)

The web server is the OAuth client. It holds the client secret and the user's tokens; the browser holds one opaque session cookie. In Next.js this is the BFF in `nextjs-bff`; the same shape works in any server framework.

This page is the protocol: sign-in, the refresh grant, sign-out, and what to test. The server-side plumbing (session cookie attributes, the session store and its lifetimes, the refresh lock, the reads proxy and `apiAction`) is in `nextjs-bff` and isn't repeated here.

## Sign-in

```
browser ─GET /app/authorize?next=/app/x──────► web server
            creates auth record {state, verifier, nonce, next} in the store (TTL 10 min)
            sets auth cookie (random id, HttpOnly, Secure, SameSite=Lax, Max-Age 600)
        ◄─302 to issuer /authorize?client_id&redirect_uri&response_type=code&scope&state
                &code_challenge=S256(verifier)&code_challenge_method=S256&nonce&resource
browser ─(signs in at the authorization server)─► 302 /app/callback?code&state
browser ─GET /app/callback───────────────────► web server
            takes (reads and deletes) the auth record named by the auth cookie
            checks state equals the record's state; clears the auth cookie
            POST issuer /token (client_secret_basic, code, code_verifier, redirect_uri)
            validates the ID token (iss, aud, exp, nonce, signature)
            creates session record {access, refresh, accessExp, signedIn} → session cookie
        ◄─302 to record.next (a same-site path, checked)
```

- The auth cookie is `Lax` because the callback is a top-level navigation from another site; the session cookie is `Strict`.
- `next` is validated when stored and when used: a relative path starting with a single `/`, no `//`, no scheme, no backslash. Pages that start or finish sign-in are never a `next`.
- Take the auth record atomically (read + delete), so a callback URL can't be replayed.
- Error replies on the callback (`error=access_denied`, ...) end the attempt and show a friendly page; never echo `error_description` as HTML.

## Refreshing

The refresh grant: `POST issuer /token` (client-authenticated) with `grant_type=refresh_token`, the current refresh token and, when the client uses resource indicators, the same `resource`. Store the **new** refresh token the reply carries: refresh tokens rotate, and the old one is dead.

- Refresh ahead of expiry, and once after a backend `401` that carries `WWW-Authenticate: Bearer`; a second refusal ends the session. When and how (the cross-replica lock, compare-and-set, which bodies may be retried) is `nextjs-bff` section 2.
- Two refreshes with the same token look like token theft to the server's reuse detection, which revokes the whole family and signs the user out. That is why the BFF serialises refreshes per session.
- If the authorization server offers a short reuse grace window for this client (see `oauth-server`), a retried refresh after a lost reply still works; don't rely on it instead of the lock.
- `invalid_grant` on refresh means the session is over (expired, revoked, reused): delete the record and send the user to sign in; don't retry.
- Session lifetimes follow the authorization server's refresh-token lifetimes for this client: idle limit and absolute limit (`oauth-server` sets them, `nextjs-bff` applies them to the store).

## Sign-out

1. POST from the app's own page (same-origin) to the app's logout route.
2. Revoke the refresh token at `/oauth2/revoke` (client-authenticated).
3. Delete the session record; clear the cookie.
4. Optionally redirect to the authorization server's logout so its sign-in session ends too (it then revokes the first-party tokens it issued from that session).

If the server-side logout is the authorization server's own page, it ends the sign-in session and redirects back to a "logout complete" route that deletes the record and cookie.

## Configuration

`public_url`, `issuer`, `client_id`, `client_secret` (secret store), `redirect_uri` (= `public_url` + fixed path), `scopes`, `resource`, store URL, cookie names. Read per request, so one build image serves every environment.

## Tests

- Callback without the auth cookie, with a different state, or replayed → refused, no token call.
- Token reply with a wrong-issuer, wrong-audience, expired or wrong-nonce ID token → refused.
- `next` values `//evil.com`, `https://evil.com`, `/\evil.com`, `/callback` → replaced by the default page.
- Two concurrent requests near expiry → one refresh.
- Guard `401` → one refresh and retry; handler `401` → passed through.
- Sign-out revokes the refresh token and clears the cookie even if revocation fails.
