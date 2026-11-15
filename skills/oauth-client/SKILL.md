---
name: oauth-client
description: "Use when implementing, reviewing or testing the client side of OAuth 2.x / OpenID Connect in any language: signing users in to a web app through a BFF (confidential client), an SPA or a native/mobile app (public client), social sign-in with Google/Apple/Microsoft or any OIDC provider, calling an API with client credentials, storing and refreshing tokens, validating ID tokens, state/nonce/PKCE, logout and revocation."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for OAuth 2.1 authorization servers and clients.
metadata:
  author: firmansyahn
  version: "0.1.2"
---

# OAuth / OIDC clients

**Principle:** Pick the client shape before the code: tokens stay where the client can keep them secret, and state, nonce and PKCE bind each sign-in to one browser, once.

Pick the client shape first; most mistakes come from using a browser-SPA pattern where a server-side client fits.

| You are building | Shape | Reference |
|---|---|---|
| A web app with its own server (Next.js, Go, Rails...) | **Confidential client behind a BFF**: tokens stay on the server, the browser holds a session cookie | [references/web-bff-client.md](references/web-bff-client.md) |
| A mobile or desktop app | Public client, system browser, PKCE, claimed https redirect | [references/public-clients.md](references/public-clients.md) |
| A browser-only SPA with no server | Public client with PKCE and short-lived, rotating tokens; prefer adding a BFF | [references/public-clients.md](references/public-clients.md) |
| "Sign in with Google/Apple/Microsoft/..." for your own users | Server-side OIDC relying party that maps the provider identity to a local account | [references/social-login.md](references/social-login.md) |
| A backend job or integration calling an API | Client credentials | [references/service-clients.md](references/service-clients.md) |

Related: `oauth-server` (the other side), `nextjs-bff` (the Next.js BFF this plugs into), `agent-skills-authoring` (rule format, adding a rule).

## Rules for every client

- **Use a maintained library** for the protocol (Go: `golang.org/x/oauth2` + `coreos/go-oidc` or `zitadel/oidc` `rp`; Node: `openid-client`; mobile: AppAuth). Configure it from the provider's discovery document (`/.well-known/openid-configuration`).
- **Authorization code + PKCE S256, always**, also for confidential clients. Never the implicit flow, never the password grant.
- **`state`** (CSRF, ties the callback to the request), **`nonce`** when an ID token is requested, **PKCE verifier**: random per attempt, stored server-side (or in the app's secure storage), single use, short-lived (about 10 min), bound to the browser that started it by an `HttpOnly` cookie.
- **Exact redirect URI**, registered with the provider; the callback is a fixed path, configured from the app's public URL, never built from `Host`.
- **Validate the ID token** (the library does it; verify it's on): signature against the issuer's JWKS, `iss` equals the configured issuer, `aud` contains your client id, `exp`/`iat` sane, `nonce` matches, `azp` if present. Use the ID token to learn who signed in; never send it to an API as a credential.
- **Request a `resource`/audience** when the server supports it, and only the scopes you need.
- **Store tokens where scripts can't read them**: server-side store (BFF), Keychain/Keystore (native). Never `localStorage`, never URLs, never logs.
- **Refresh with rotation in mind:** always store the new refresh token from a refresh reply; serialise refreshes per session (a lock), because a parallel refresh reuses a rotated token and the server revokes the whole family.
- **Handle `401` with `WWW-Authenticate: Bearer`** by refreshing once and retrying; a second failure ends the session.
- **Sign-out:** revoke the refresh token (RFC 7009), clear the local session, then optionally the provider's end-session endpoint.
- **Client secrets** come from the environment or a secret store, are never committed, and can rotate with overlap.
- **Outbound calls are SSRF-safe** when the issuer is configurable by tenants: only https, an egress allow/deny policy, no private addresses unless intended, timeouts.

## Rule IDs

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Security

| ID | Rule | Impact | Check |
|---|---|---|---|
| [sec-oauth-state-pkce](rules/sec-oauth-state-pkce.md) | Bind OAuth state, nonce and PKCE to the browser and use them once | CRITICAL | test |
| [sec-safe-redirect-next](rules/sec-safe-redirect-next.md) | Validate return-to URLs as same-site paths | CRITICAL | test |

## Reviewing

Read the sign-in start, the callback, token storage, refresh and sign-out against the rules above and the checklist below, and check the tests in its last line exist. Report each finding with its rule ID, impact and site, in the format of `agent-skills-authoring`.

## Checklist

- [ ] Library configured from discovery; code + PKCE S256; `state` and `nonce` single-use and browser-bound
- [ ] Exact, configured redirect URI
- [ ] ID token fully validated; not used as an API credential
- [ ] Tokens only in server-side store or OS secure storage; never in browser storage, URLs or logs
- [ ] New refresh token stored on every refresh; one refresh at a time per session; refresh-and-retry once on a bearer 401
- [ ] Sign-out revokes and clears
- [ ] Tests: wrong/missing state, replayed callback, wrong nonce, wrong issuer/audience, expired ID token, refresh reuse, revoked session
