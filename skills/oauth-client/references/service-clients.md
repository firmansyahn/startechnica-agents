# Service clients (client credentials)

A backend job, integration or plugin calling an API as itself, with no user present.

## Flow

```
POST /oauth2/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=billing:read&resource=https://api.example.com/api/v1
```

- `client_secret_basic` (or `private_key_jwt` where supported); never the secret in a query string or JSON body logs.
- Request only the scopes the job needs, and the `resource` it calls.

## Token cache

- Cache the access token in memory until `expires_in` minus a margin (30–60 s); one token fetch at a time (singleflight / mutex), others wait for it.
- On a `401` with `WWW-Authenticate: Bearer`, drop the cached token, fetch a new one, retry once.
- No refresh tokens: a new client-credentials call replaces the token.
- With many replicas, each may cache its own token; that's fine unless the server limits issuance, then share the cache.

## Secrets

- From the environment or a secret manager, never committed.
- Support rotation: the server accepts old and new secrets during an overlap; deploy the new one, then retire the old.
- One client per integration and environment, so one can be revoked without breaking others.

## Libraries

- Go: `golang.org/x/oauth2/clientcredentials` (`Config.TokenSource` already caches and renews; wrap its `http.Client`).
- Node: `openid-client` `client.grant({ grant_type: "client_credentials" })` plus a small cache.
- Set timeouts on the token call and the API calls; retry the token call with backoff on 5xx, never on 4xx.

## Tests

- Token reused until near expiry, then renewed.
- Concurrent callers trigger one token fetch.
- `invalid_client` surfaces as a clear configuration error, not a retry loop.
- Bearer `401` → one renew and retry.
