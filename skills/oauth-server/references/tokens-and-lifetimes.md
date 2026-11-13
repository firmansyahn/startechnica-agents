# Tokens, lifetimes and keys

## Formats

| Token | Format | Why |
|---|---|---|
| Access | **Opaque random string with a prefix** (`<app>_at_...`), stored as SHA-256 | One indexed lookup per request also checks the session, grant and client are live, so revocation is immediate. Choose JWT access tokens only when resource servers must verify offline (other teams, other networks), and then keep them short (5–15 min) |
| Refresh | Opaque with a prefix (`<app>_rt_...`), stored as a hash | Never a JWT: it must be revocable and rotate |
| Authorization code | Opaque, single use, ~60 s, stored as a hash | |
| ID token | JWT, signed (ES256 or RS256), published keys at `/oauth2/jwks` | For the client to learn who signed in; never accepted as an API credential |

- Random secrets: 32 bytes from a CSPRNG, base64url without padding.
- Prefixes let secret scanners find leaked tokens and let API guards tell a token from an API key without parsing.
- Store only hashes. A database dump must not contain a usable token.

## What a token row records

`id`, `kind` (code/access/refresh), `hash`, `family_id` (refresh chain), `grant_id`, `session_id` (sign-in session it came from), `client_id`, `subject_kind`, `subject_id`, `tenant_id`, `resource`, `scopes`, `expires_at`, `revoked_at`, `used_at` (codes and rotated refresh tokens), timestamps.

Index the hash. A scheduler deletes expired and revoked rows in bounded batches.

## Lifetimes (starting points; make them settings)

| Client and subject | Access | Refresh idle | Refresh absolute |
|---|---|---|---|
| First-party web (BFF), admin | 15 min | session idle (e.g. 30 min) | 12 h |
| First-party web, end user | 15 min | 8 h | 8 h |
| Native app | 15 min | 7–30 days | 30–90 days |
| Third-party / MCP | 15 min | 7 days | 30 days |
| Service (client credentials) | 15–60 min | none | none |

The sign-in session that produced a first-party web token caps it: when the session ends (sign-out, idle, absolute), its first-party tokens end too. Third-party, MCP and native grants outlive the browser session and end on revocation, password change, user disablement or refresh reuse.

## Refresh rotation and reuse detection

- Every refresh issues a new refresh token in the same family and marks the old one used.
- **A used refresh token presented again revokes the whole family** (theft signal), and the grant if the product prefers.
- **Grace window for a confidential BFF only:** a BFF can lose the reply of a rotation (timeout, crash) and retry with the old token. Allow that client a short window (~30 s): when the most recently rotated token comes back within the window and its successor was never used, issue a fresh pair in the same family and revoke the unused successor. Outside the window, or if the successor was used, revoke the family. Public clients get no window.
- The BFF side serialises refreshes per session with a lock (`nextjs-bff`), which keeps the window rarely needed.

## Revocation (`POST /oauth2/revoke`, RFC 7009)

- Accepts access or refresh tokens; revoking a refresh token revokes its family and the access tokens issued from it.
- Always answers 200 for an unknown or already-revoked token (no oracle).
- Other revocation triggers: sign-out (first-party session tokens), password change (all grants of the subject except service clients), user or client disabled, grant revoked by the user in "connected apps", tenant suspended.

## Introspection (`POST /oauth2/introspect`, RFC 7662)

- Only for authenticated confidential clients (resource servers). Answer `{"active": false}` for anything not valid, without saying why.

## Signing keys

- Keys in a table (private key encrypted at rest or in a KMS), with `created_at`, `activates_at`, `retires_at`.
- The newest active key signs; JWKS publishes every key that is active or recently retired, so tokens signed just before a rotation still verify.
- Several replicas starting together may each create the first key: allow it (all are published, newest signs) or create it in a migration.
- Rotate on a schedule (e.g. 90 days) and on suspicion; `kid` in every JWT header.

## Client secrets

- Stored as hashes; shown once at creation.
- Rotation with overlap: a new secret is added with the old one kept until an expiry, so a deployed client can switch without downtime.
- Confidential clients authenticate with `client_secret_basic` (or `private_key_jwt` for higher assurance); never secrets in query strings.
