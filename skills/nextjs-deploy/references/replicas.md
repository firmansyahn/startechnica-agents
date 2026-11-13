# Probes, replicas and rolling deploys

## Probes

[assets/app/livez/route.ts](../assets/app/livez/route.ts), [assets/app/readyz/route.ts](../assets/app/readyz/route.ts), [assets/src/libs/health.ts](../assets/src/libs/health.ts):

| Path | Answers | Checks |
|---|---|---|
| `/livez` | `200 {"status":"ok"}`, `Cache-Control: no-store` | Nothing beyond the process answering, so a dependency outage never restarts the pod |
| `/readyz` | `200 {"status":"ok"}`, or `503 {"status":"unavailable","reason":"<SETTING>"}` | The settings the proxy and the session layer rely on. `API_BASE_URL` must parse as an `http(s)` URL. In production, `REDIS_URL` (the shared session store) and the OAuth client secret must be set. The reason names the variable, never its value |

- Both probes answer from this process alone. The web pod doesn't wait on the backend's readiness: the backend's own `/readyz` decides whether it takes traffic. If the web pod waited on it, it would leave the Service whenever the backend blinked, taking down the pages that don't need the backend too.
- `readiness()` takes its input as a parameter (defaulting to the environment), so a unit test covers each reason without touching `process.env`.
- With Cache Components on (`cacheComponents: true`), a `GET` handler that reads no request data is prerendered at build. Call `await connection()` first in both probes. The team's apps don't enable Cache Components, so their probes don't need it.

## Sessions: Redis in production

Sessions and tokens live in Redis or Valkey (`REDIS_URL`), so every replica sees every session and no sticky routing is needed (`nextjs-bff`). Without `REDIS_URL` the app keeps sessions in its own memory. That is fine for one development process, but `/readyz` fails in production without it.

## Version skew across a rollout: no `deploymentId`

The team sets no `deploymentId`. Each `next build` gets its own build id, and every navigation reply carries it. A page left open across a deploy therefore loads the new build in full on its next navigation.

A `deploymentId` read from the environment broke this. `next start` reads `next.config.*` again at run time, when the build's variables are gone, so the ids never matched and every link click reloaded the whole page. Don't add one unless the same literal value reaches both the build and the start.

A Server Action called from a page of the previous build fails ("server action not found"), and `runAction` turns that into "reload the page" (`nextjs-data`).

## Server Actions settings

- `experimental.serverActions.bodySizeLimit` is raised in `next.config.mjs` where actions save large bodies (HTML content, templates). The reads proxy has its own limit, `experimental.proxyClientMaxBodySize`, which buffers request bodies up to that size and truncates beyond it. Size it to the backend's largest accepted upload.
- **Not in use yet:** `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Next encrypts Server Function closure variables. At run time it uses this variable when set, otherwise the key generated at build time and stored in the build's server-actions manifest. Replicas of one image therefore already share a key, and the team's actions take explicit input with no inline closures. Set it from a Secret on every pod (`openssl rand -base64 32`) once an app needs encrypted data to survive a redeploy.
- **Not in use yet:** `experimental.serverActions.allowedOrigins`. Next compares the `Origin` host with `x-forwarded-host` (or `host`). An ingress that forwards the public host needs no entry. Add one only if a proxy forwards its own internal host, and remember the list is evaluated in `next.config.*`.

## Shared server cache

**Not in use yet.** The team's apps read through TanStack Query and barely use Next's server cache (ISR, `use cache`, `revalidateTag`). An app that starts relying on it with several replicas needs a shared `cacheHandler`/`cacheHandlers` (Redis) with `cacheMaxMemorySize: 0`. Otherwise each pod serves its own copy and `revalidateTag` on one pod doesn't reach the others (see `self-hosting.md` in the installed Next docs).

## Shutdown and keep-alive

- `next start` handles `SIGTERM` itself: it stops accepting connections, finishes in-flight requests and pending `after()` callbacks, then exits with 143. The image runs the Next binary as PID 1 so the signal reaches it. A shell wrapper or `yarn start` in between can swallow the signal.
- **Not in use yet:** a `preStop` sleep in the chart, so the Service stops routing before `SIGTERM`, and `next start --keepAliveTimeout <ms>` set above the ingress's idle timeout. Note that `KEEP_ALIVE_TIMEOUT` is read only by the standalone `server.js`, not by `next start`.
