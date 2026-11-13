# Clients, scopes and consent

## Client kinds

A client's kind is fixed at registration and decides everything else. Keep the kinds in code, not data: a kind is a security statement.

| Kind | Registered by | Client auth | Grants | Subject | Consent | Resource |
|---|---|---|---|---|---|---|
| First-party web (BFF) | operator, seeded | secret (`client_secret_basic`) + PKCE | code, refresh | user | never | the product's own console/app API |
| First-party SPA (rare; prefer a BFF) | operator | none + PKCE | code, refresh (rotating, short) | user | never | its API |
| First-party native | operator | none + PKCE | code, refresh | user | never | public API |
| Third-party | tenant admin | secret, or none + PKCE for public apps | code, refresh (`offline_access`) | user | always | public API |
| MCP client | tenant admin | none + PKCE | code, refresh | user | always | MCP endpoint |
| Service | tenant admin | secret | client credentials | the client itself | none | public API |

- A client gets tokens only for its kind's resource; any other `resource` is refused at authorize and token.
- First-party clients belong to the platform and work for every tenant; every other client belongs to one tenant and accepts only users with membership there.
- A service client is bound to a tenant and a role, not to the person who created it, so an integration survives that person leaving.

## Registration rules

- **Redirect URIs:** absolute, no fragment, no wildcards. Web clients: `https` only (`http://localhost`/`127.0.0.1` allowed in development). Native clients: claimed `https` links on a domain the app proves (`apple-app-site-association`, `assetlinks.json`), a private-use scheme in reverse-DNS form (`com.example.app:/oauth2redirect`), or loopback (`http://127.0.0.1/...`, any port at runtime).
- **Allowed web origins** (for CORS on the token endpoint, public clients only): exact origins.
- **Scope ceiling:** the maximum scopes the client may ever request; a request beyond it is refused, not trimmed silently.
- **Client ids** are random and public; secrets are shown once.
- **No dynamic registration or remote client metadata fetching** by default. If MCP or other ecosystems require it (Client ID Metadata Documents, RFC 7591), add it deliberately with SSRF-safe fetching and a review queue.

## Scopes

- A grammar tied to the API's structure, e.g. `<app>[.<resource>]:<read|write>`: `read` allows `GET`/`HEAD`, `write` allows the rest and implies `read`; an app scope covers its resources (`billing:write` ⊇ `billing.invoices:write`).
- The route's app comes from the package that registers it, so no per-route scope table is needed.
- Plus OIDC scopes (`openid`, `profile`, `email`), `offline_access` for refresh tokens on third-party clients, and narrow special scopes (e.g. an "enrolment only" scope that reaches just the MFA setup routes when MFA is required but not yet set up).
- **Enforcement:** the guard refuses unless a token scope covers the route's app/resource and method, then runs the normal role/permission check. Scopes never grant what the role lacks.

## Consent

- Shown for third-party and MCP clients, every time a client asks for scopes not yet granted.
- Lists only scopes the user's role can actually use (eligible scopes); others are dropped with a note, or the request fails if a required one is missing.
- Shows the client's name, owner, redirect host and requested access in plain language.
- The approved grant is stored (`client`, `subject`, `tenant`, scopes) and listed in the user's "connected apps", where it can be revoked (revoking its tokens).
- The consent page can't be framed (`frame-ancestors 'none'`), and its POST checks `Origin`.

## Native apps (RFC 8252)

- Use the system browser (ASWebAuthenticationSession, Custom Tabs, AppAuth), never an embedded web view.
- Public client, PKCE, claimed https redirect preferred over a custom scheme.
- Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from configuration (bundle ids, package names, certificate fingerprints), with no redirect.
- Longer refresh lifetimes with rotation and reuse detection; the app stores the refresh token in the Keychain/Keystore.
