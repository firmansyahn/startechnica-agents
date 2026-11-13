---
name: oauth-server
description: "Use when designing, implementing, reviewing or testing an OAuth 2.x / OpenID Connect authorization server inside a product (any language): choosing a library, client kinds and registration, the authorization code + PKCE flow, sign-in and consent pages, scopes, access/refresh/ID tokens and their lifetimes, refresh rotation and reuse detection, revocation, introspection, JWKS and key rotation, discovery and protected-resource metadata, native-app redirects, protecting resource servers with the tokens, or an MCP server's authorization."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode or similar harness, and for OAuth 2.1 authorization servers and clients.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# OAuth / OIDC authorization server

Build on the current best practice (OAuth 2.1 draft, RFC 9700 Security BCP, OpenID Connect Core), with a **certified library doing the protocol** and the product's own code deciding policy: who may sign in, which clients exist, what each may get, how long tokens live.

Related: `oauth-client` (the other side), `nextjs-bff` (a first-party web client), `go-project-layout` (layering when the server is in Go), `go-security`, `agent-skills-authoring` (rule format, adding a rule). Details:
- [references/tokens-and-lifetimes.md](references/tokens-and-lifetimes.md): token formats, storage, lifetimes, refresh rotation, revocation, signing keys
- [references/clients-scopes-consent.md](references/clients-scopes-consent.md): client kinds, registration rules, redirect URIs, scopes, consent, native apps
- [references/endpoints-and-security.md](references/endpoints-and-security.md): endpoints, metadata, sessions and cookies, throttling, resource-server checks, test list

## 1. Ground rules

- **Use a library for the protocol** (Go: `zitadel/oidc` `op`, `ory/fosite`; Node: `oidc-provider`; Java: Spring Authorization Server; .NET: OpenIddict). Pin the version. Write storage, policy and pages yourself; never hand-roll the token endpoint, PKCE checks or ID token signing.
- **Grants:** authorization code (with PKCE) and refresh token for users; client credentials for machine clients. **No implicit grant, no resource-owner password grant, no device code unless a real device needs it.**
- **PKCE S256 for every client**, confidential ones included; refuse `plain` and a missing challenge.
- **Exact redirect URI match** (string equality against the registered list). The only relaxation: native apps on a loopback address may use any port (RFC 8252).
- **One audience per token** (`resource` parameter, RFC 8707): a token for the public API is refused by the admin API and vice versa.
- **Issuer and every metadata URL come from configuration** (`oauth.endpoint`), never from `Host` or `X-Forwarded-*`.
- **No open dynamic registration** unless the product needs it; clients are registered by an operator or tenant admin in the console.
- **Sign-in stays on the authorization server's pages.** Clients never collect passwords.

## 2. Architecture

```
domain package (no HTTP):  client kinds, scope grammar, lifetimes, token format, consent rules,
                           storage the library runs on, sign-in/consent decisions
HTTP package:              mounts the library's handlers at /oauth2/*, the sign-in and consent
                           endpoints, metadata under /.well-known/*
resource servers:          one verifier used by every API surface: token → caller (subject,
                           tenant, client, scopes), refusing anything not issued for that surface
```

- One verifier function shared by all API surfaces, so revocation, expiry, audience and session checks can't drift.
- The scope check sits in the API guard (route → required scope); the existing permission/role checks still run after it. **A scope narrows what a role allows; it never adds permissions the user lacks.**
- Every token records the client, subject, tenant, grant, sign-in session and resource it was issued for, so any of them can be revoked and audited.

## 3. Flow (authorization code + PKCE)

1. `GET /oauth2/authorize` with `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256`, `resource`, (`nonce` for OIDC). Validate all of it against the client before showing anything; an unknown client or redirect is an error page, never a redirect.
2. No sign-in session → the sign-in page, carrying an opaque handle to the stored request (not the raw parameters).
3. Sign-in (password, MFA, lockout and throttling as the product defines) → sign-in session cookie.
4. Consent when the client kind requires it, listing only scopes the user is allowed to grant.
5. Redirect with a single-use `code` (about 60 s lifetime) and the client's `state`.
6. `POST /oauth2/token` with the code, `code_verifier`, `redirect_uri` and client authentication → access token, refresh token (if allowed), ID token (if `openid`).
7. A reused code revokes everything issued from it.

## 4. Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections: [rules/_sections.md](rules/_sections.md).

### Flow

| ID | Rule | Impact | Check |
|---|---|---|---|
| [oauth-pkce-s256-every-client](rules/oauth-pkce-s256-every-client.md) | Require PKCE S256 from every client | CRITICAL | test |
| [oauth-exact-redirect-match](rules/oauth-exact-redirect-match.md) | Match redirect URIs exactly; never redirect to an unknown one | CRITICAL | test |
| [oauth-single-use-code](rules/oauth-single-use-code.md) | Use each authorization code once; a replay revokes what it issued | CRITICAL | test |
| [oauth-protocol-library](rules/oauth-protocol-library.md) | Let a certified library run the protocol | HIGH | review |
| [oauth-code-grants-only](rules/oauth-code-grants-only.md) | Offer only the authorization code, refresh and client credentials grants | HIGH | test |

### Tokens

| ID | Rule | Impact | Check |
|---|---|---|---|
| [oauth-opaque-hashed-tokens](rules/oauth-opaque-hashed-tokens.md) | Store tokens, codes and secrets only as hashes | HIGH | review |
| [oauth-refresh-rotation-reuse](rules/oauth-refresh-rotation-reuse.md) | Rotate refresh tokens and revoke the family on reuse | HIGH | test |
| [oauth-session-ends-first-party-tokens](rules/oauth-session-ends-first-party-tokens.md) | End first-party tokens with the sign-in session that produced them | MEDIUM | test |
| [oauth-signing-key-overlap](rules/oauth-signing-key-overlap.md) | Rotate signing keys with an overlap in JWKS | MEDIUM | test |

### Access

| ID | Rule | Impact | Check |
|---|---|---|---|
| [oauth-one-resource-per-token](rules/oauth-one-resource-per-token.md) | Issue each token for one resource and refuse it everywhere else | CRITICAL | test |
| [oauth-scopes-narrow-roles](rules/oauth-scopes-narrow-roles.md) | Let scopes narrow what a role allows, never widen it | CRITICAL | test |
| [oauth-one-verifier](rules/oauth-one-verifier.md) | Verify bearer tokens in one function for every API surface | HIGH | review |
| [oauth-consent-third-party](rules/oauth-consent-third-party.md) | Ask consent for third-party and MCP clients, and let users revoke it | HIGH | test |
| [oauth-scope-ceiling-refuses](rules/oauth-scope-ceiling-refuses.md) | Refuse scopes beyond the client's ceiling instead of trimming them | MEDIUM | test |

### Pages and endpoints

| ID | Rule | Impact | Check |
|---|---|---|---|
| [oauth-issuer-from-config](rules/oauth-issuer-from-config.md) | Take the issuer and metadata URLs from configuration | HIGH | test |
| [oauth-harden-signin-pages](rules/oauth-harden-signin-pages.md) | Keep the sign-in and consent pages unframeable and check Origin on their POSTs | HIGH | test |
| [oauth-throttle-signin](rules/oauth-throttle-signin.md) | Throttle sign-in by address and by account | HIGH | test |
| [oauth-never-log-credentials](rules/oauth-never-log-credentials.md) | Never log codes, tokens, secrets, verifiers or passwords | HIGH | review |
| [oauth-no-oracle-replies](rules/oauth-no-oracle-replies.md) | Answer refusals uniformly so endpoints don't reveal what exists | MEDIUM | test |

## 5. Reviewing

1. **Scope:** the diff, or the authorization server package, its HTTP mounting, the API guards and the sign-in and consent pages.
2. **Run the tests** for the refusals in [references/endpoints-and-security.md](references/endpoints-and-security.md) ("Tests to keep"); a rule whose check is `test` with no such test is a gap to report.
3. **Read the code against the rules** below; the `review` ones (library, hashes, one verifier, logging) only reading finds. Open each rule you cite and match its "Incorrect" shape.
4. **Report** each finding with its rule ID, impact and site, in the format of `agent-skills-authoring`. The authorization server is an authentication path: don't lower an impact.

## 6. Checklist

- [ ] Certified library for the protocol, pinned; product policy in its own package (`oauth-protocol-library`)
- [ ] Code + PKCE S256 for every client; no implicit or password grant (`oauth-pkce-s256-every-client`, `oauth-code-grants-only`)
- [ ] Exact redirect matching; loopback any-port only for native clients (`oauth-exact-redirect-match`)
- [ ] Codes single use; a replay revokes what they issued (`oauth-single-use-code`)
- [ ] One resource per token, enforced at authorize, token and every API surface by one verifier (`oauth-one-resource-per-token`, `oauth-one-verifier`)
- [ ] Issuer from config; discovery and protected-resource metadata published (`oauth-issuer-from-config`)
- [ ] Opaque access/refresh tokens stored as hashes (or short-lived JWTs with a revocation story); refresh rotation with reuse detection (`oauth-opaque-hashed-tokens`, `oauth-refresh-rotation-reuse`)
- [ ] Sign-in and consent cookies hardened; sign-in throttled; origin checks on POST endpoints (`oauth-harden-signin-pages`, `oauth-throttle-signin`)
- [ ] Scopes narrow roles and never widen them; consent shows only grantable scopes (`oauth-scopes-narrow-roles`, `oauth-consent-third-party`)
- [ ] Revocation and introspection work and answer uniformly; signing keys rotate with overlap in JWKS (`oauth-no-oracle-replies`, `oauth-signing-key-overlap`)
- [ ] No codes, tokens, secrets or passwords in logs (`oauth-never-log-credentials`)
- [ ] Tests for every refusal in `references/endpoints-and-security.md`
