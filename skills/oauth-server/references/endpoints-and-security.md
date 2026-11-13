# Endpoints, sessions and security

## Endpoints

| Path | Purpose |
|---|---|
| `GET /oauth2/authorize` | Start the authorization request; validate client, redirect, PKCE, scope, resource; store the request behind an opaque handle |
| `POST /oauth2/login/<subject-kind>` | The sign-in page posts here with the request handle; on success sets the sign-in session and resumes |
| `POST /oauth2/consent` | Approve or deny the requested scopes |
| `POST /oauth2/token` | Code exchange, refresh, client credentials |
| `POST /oauth2/revoke` | RFC 7009 |
| `POST /oauth2/introspect` | RFC 7662, confidential clients only |
| `GET /oauth2/userinfo` | OIDC claims for the token's subject |
| `GET /oauth2/jwks` | Public signing keys |
| `POST /oauth2/logout` | End the sign-in session, revoke its first-party tokens, redirect to a registered post-logout URL |
| `GET /.well-known/openid-configuration`, `/.well-known/oauth-authorization-server` | Discovery (RFC 8414) |
| `GET /.well-known/oauth-protected-resource/<api path>` | Protected-resource metadata (RFC 9728) per API surface: which issuer, which scopes |

APIs answer a missing or invalid token with `401` and `WWW-Authenticate: Bearer resource_metadata="<url>"` so clients (MCP clients especially) can discover the server.

## Sign-in sessions

- A row per subject per browser: subject kind and id, tenant, MFA used, created/last-used/expiry. The cookie carries a random handle; the row stores its hash.
- Cookie: host-only, `__Secure-` (or `__Host-` when `Path=/`), `Secure`, `HttpOnly`, `SameSite=Strict` (`Lax` where a cross-site redirect must carry it), `Path=/oauth2/`.
- Idle and absolute limits per subject kind; once ended, the next authorize shows sign-in again, so a client can't outlive the limits by re-authorizing silently.
- One cookie per subject kind if admins and end users can be signed in side by side.
- A sign-in hint (`login_hint`, a tenant hint for branding) only pre-fills or brands the page; identity and tenant always come from the sign-in itself.

## Hardening

- **Origin check** on every state-changing POST used by browsers (`login`, `consent`, `logout`, token when it reads a cookie): refuse when `Origin` is present and not the public origin.
- **No framing** of sign-in and consent pages (`Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`).
- **Throttling:** sign-in attempts by IP and by username (in a shared store when there are replicas); account lockout per the product's policy; per-client request limits on the token endpoint.
- **Same host as user-generated content?** Serve that content with `Content-Security-Policy: sandbox ...` (never `allow-same-origin`) and `X-Content-Type-Options: nosniff`, so it can't read or set the authorization server's cookies.
- **Error responses** follow RFC 6749 (`invalid_request`, `invalid_client`, `invalid_grant`, `unauthorized_client`, `unsupported_grant_type`, `invalid_scope`); never reveal whether a user exists.
- **Logging:** client, subject, grant type, result, request id; never codes, tokens, secrets, verifiers or passwords.
- **Passwords:** argon2id (or bcrypt) hashes; MFA with TOTP/WebAuthn; MFA-required policies can issue an enrolment-only token until set up.

## Resource-server verifier

One function, used by every API surface:

1. Parse `Authorization: Bearer <token>`; tell an access token from an API key by prefix.
2. Look up the hash; refuse if unknown, expired, revoked, from a revoked grant, ended session, disabled client, gone subject, or **issued for another resource**.
3. Build the caller (subject, tenant, client id, scopes) and pass it to the route guard: scope check, then the role/permission check.
4. All refusals answer the same `401` (no detail about which check failed).

## MCP servers

An MCP endpoint is a resource server with its own resource identifier: publish protected-resource metadata for it, accept only tokens issued for it, map each tool to a required scope, and filter the tool catalog by the token's scopes and the user's role. MCP clients are public clients with PKCE and consent.

## Tests to keep

- Authorize refuses: unknown client, unregistered or near-miss redirect (trailing slash, case, extra query), missing/`plain` PKCE, scope beyond the ceiling, wrong resource. Unknown client or redirect never redirects.
- Token refuses: wrong verifier, reused code (and revokes its tokens), code for another client or redirect, expired code, wrong client secret, wrong resource.
- Refresh: rotation works; reuse revokes the family; the BFF grace window works only for that client, only inside the window, only when the successor was unused.
- Revocation is immediate on every surface; revoke answers 200 for unknown tokens; introspection answers `active: false` uniformly.
- A token for one surface is refused by another.
- Sign-out ends first-party tokens but not third-party grants; password change ends grants.
- Sign-in throttling and lockout; origin check on POSTs; sign-in and consent pages not frameable.
- Discovery URLs use the configured issuer regardless of `Host`/`X-Forwarded-Host`.
- JWKS keeps a retired key until its tokens have expired.
