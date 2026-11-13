# Kubernetes: what the chart must set

The app is deployed by a Helm chart in a separate chart repository. `<app>:release` triggers that repository's pipeline on the tier's chart branch with the new image tag ([ci.md](ci.md)). This repo holds no Deployment manifest. At most it holds a routing reference (for example a Gateway API `HTTPRoute` that sends the backend's paths to the backend Service and the rest to the web Service).

For the web app, the chart must set:

| What | Value |
|---|---|
| Image | `<registry>/<project>/<app>-web:<ref-slug>-<short-sha>-<node-major>`, the tag `<app>:build` pushed |
| Container port | `3000` (`PORT` in the image) |
| Settings | Every runtime setting as an environment variable: non-secrets from a ConfigMap (`API_BASE_URL`, `APP_BASE_URL`, `APP_ENV`, `TIMEZONE`, ...) and secrets from a Secret (the OAuth client secret, `REDIS_URL` with its password). The image carries none of them ([runtime-config.md](runtime-config.md)) |
| Liveness probe | `httpGet /livez` on the app port |
| Readiness probe | `httpGet /readyz` on the app port; failing it takes the pod out of the Service without a restart |
| Replicas | More than one only with `REDIS_URL` set (sessions shared through Redis) |
| Security context | Non-root: `runAsUser: 14918`, `runAsGroup: 14918`, `runAsNonRoot: true` (the image's `startechnica` user) |

Not in use yet (add when needed, see [replicas.md](replicas.md)):

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` from a Secret, the same on every pod.
- A `preStop` sleep and a grace period covering Next's drain.
- `--keepAliveTimeout` above the ingress idle timeout.

Routing: the backend's public paths (`/api/...`, `/oauth2/...`, `/.well-known/...`) are routed to the backend at the ingress, and `proxy.ts` rewrites the same prefixes per request to `API_BASE_URL`, for setups without that ingress routing (local, compose). Keep the two prefix lists in step.
