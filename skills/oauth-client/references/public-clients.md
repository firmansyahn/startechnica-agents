# Public clients: native apps and SPAs

A public client can't keep a secret, so PKCE, exact redirects and short-lived tokens carry the security.

## Native and desktop apps (RFC 8252)

- **System browser only:** `ASWebAuthenticationSession` (iOS/macOS), Custom Tabs (Android), the default browser with a loopback listener (desktop). Never an embedded web view: the app could read the password, and users can't see the real address bar.
- **Library:** AppAuth (iOS, Android, JS), or the platform's equivalent; configure from discovery.
- **Redirect URI, best first:**
  1. Claimed https link on a domain you control (`https://app.example.com/oauth/callback`), verified by `apple-app-site-association` / `assetlinks.json` served by that domain.
  2. Private-use scheme in reverse-DNS form: `com.example.app:/oauth2redirect` (one slash).
  3. Desktop: loopback `http://127.0.0.1:<random port>/callback` with a listener that accepts one request.
- **PKCE S256, `state`, `nonce`** per attempt, kept in memory or secure storage until the redirect returns.
- **Tokens:** refresh token in the Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`) or Android Keystore-backed storage; access token in memory. Store the new refresh token after every refresh (rotation).
- **Serialise refreshes** in the app (one in flight; others await it), or rotation will revoke the family.
- **Sign-out:** revoke the refresh token, delete it, and clear in-memory state; optionally open the end-session endpoint in the system browser.
- **Biometrics** may gate access to the stored refresh token; they don't replace server-side session limits.

## Browser SPAs without a server

Prefer adding a small BFF (`web-bff-client.md`): browser JavaScript can be read by any XSS, and no storage there is safe for long-lived tokens. If there is truly no server:

- Code + PKCE, exact redirect, `state`, `nonce`.
- Access tokens in memory only; short lifetimes (≤ 15 min).
- Refresh tokens only if the server rotates them with reuse detection and short absolute lifetimes; keep them in memory (sign-in again after a reload) or in an `HttpOnly` cookie the authorization server sets on its token path.
- No tokens in `localStorage`/`sessionStorage`, URLs or logs.
- A strict Content-Security-Policy, because any script injection owns the tokens.

## Tests

- Redirect with a mismatched `state` or none → refused.
- Callback opened twice → second refused (verifier already consumed).
- Refresh failure with `invalid_grant` → signed out cleanly, stored tokens deleted.
- Two API calls racing on expiry → one refresh.
