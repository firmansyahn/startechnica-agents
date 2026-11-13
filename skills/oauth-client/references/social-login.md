# Social sign-in (your app as the relying party)

"Sign in with Google/Apple/Microsoft/LINE/..." signs the user in to **your** product: the provider proves an identity, your server maps it to a local account and starts your own session. Provider tokens are not kept unless the product needs to call the provider's API.

## Shape

- **Server-side flow** (confidential client), even when the front end is an SPA or a captive portal page.
- **One provider type per protocol:** a shared OIDC implementation configured per network (issuer, scopes, claim mapping, extra authorize parameters, response mode), plus a separate implementation only for providers that aren't OIDC (plain OAuth 2 with a userinfo call).
- **Provider registry in code** (compile-time list of supported networks); per-tenant credentials (client id, secret, enabled flag) stored in settings, secrets encrypted or in a secret store.
- **One callback URL per provider for the whole platform:** `<public_url>/<auth path>/<provider>/callback`, registered in each tenant's own OAuth app at the provider. The tenant is found from the stored attempt, not from the URL.

## Attempt state (server-side)

At start, create an attempt row: hash of `state`, hash of a binding-cookie value, `nonce`, PKCE verifier, provider, tenant, where to go after, created time. Set the binding cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, short `Max-Age`, scoped to the callback path).

At callback:
1. Find the attempt by the hash of `state`; consume it (single use); refuse if older than ~10 min.
2. Check the binding cookie matches (the callback happens in the browser that started).
3. Exchange the code with the PKCE verifier.
4. Validate the ID token: signature (provider JWKS), `iss`, `aud`, `exp`, `nonce`.
5. Map to an account (below), start your own session, clear the cookie.

## Provider quirks

- **Apple** posts the callback (`response_mode=form_post`): accept `POST` on the callback, and because a cross-site POST doesn't carry `SameSite=Lax` cookies, bind with the attempt row and a cookie that allows it (`SameSite=None; Secure`) or skip the cookie binding for that provider with the row's single use and age as the guard. Apple sends the user's name only on the first sign-in, in the form body, not the ID token; save it then. The client secret is a JWT you sign with your Apple key and renew (≤ 6 months).
- **Google:** `email_verified` is reliable for Gmail and Workspace; use `sub` as the stable id.
- **Microsoft (Entra ID):** multi-tenant apps use the `common`/`organizations` issuer template; validate `iss` against the `tid` in the token, not a fixed string. Use `oid` + `tid` (or `sub`) as the stable id.
- **Non-OIDC providers** (Facebook, X): no ID token; the access token calls a userinfo endpoint over https, and the id comes from that reply.

## Mapping to accounts

- Key accounts by **(provider, provider subject id)**, never by email: emails change and can be reassigned.
- **Linking to an existing account by email** only when the provider says the email is verified **and** the product's policy allows it; otherwise ask the user to sign in to the existing account first and link from settings.
- New accounts: create with the claims you need (name, email, picture), mark how they signed up, apply the product's sign-up policy (allowed domains, approval, terms).
- Store only what the product needs; don't keep provider access tokens unless it calls the provider's API, and then store them encrypted with their expiry.

## Security

- Tenant-configurable issuers and endpoints mean outbound calls go through an SSRF-safe client: https only, egress policy, no private ranges unless intended, timeouts, size limits.
- Cache discovery documents and JWKS with a TTL, keyed by issuer and client config, so a changed secret takes effect.
- The callback never reflects provider error text as HTML.

## Tests

- Missing, unknown, expired or replayed `state` → refused before any token call.
- Callback in another browser (no binding cookie) → refused (except the documented form_post handling).
- ID token with wrong `nonce`, `aud` or `iss`, expired, or bad signature → refused.
- Same email, different provider subject → not merged unless verified and allowed.
- Disabled provider or tenant without credentials → no start link, start refused.
