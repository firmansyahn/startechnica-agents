# One image for every environment

One image is built per commit and run in every environment. Kubernetes injects every setting when the pod starts, from a ConfigMap or a Secret. Nothing environment-specific is baked into the build.

## What is fixed at build time

| Fixed by `next build` | So |
|---|---|
| `NEXT_PUBLIC_*` variables: Next replaces every `process.env.NEXT_PUBLIC_X` in client code with its build-time value | Never use them for settings or anything that differs per environment, including version strings (`build.json` carries those) |
| `env` in `next.config.*` | Inlined like `NEXT_PUBLIC_*`, so don't use it |
| Pages and route handlers prerendered at build | A value read while prerendering is the build machine's value. Read settings only during a request |
| **With `output: "standalone"`: all of `next.config.*`** | `next build` writes the evaluated config into `.next/standalone/server.js` (`const nextConfig = {...}`, `__NEXT_PRIVATE_STANDALONE_CONFIG`). Anything the config computes from the environment is frozen: `rewrites`/`redirects`/`headers` destinations, `images.remotePatterns`, `serverActions.allowedOrigins`, `basePath`, `assetPrefix`. This is why the team runs `next start`, which loads the config again when the container starts |

Even with `next start`, keep `next.config.*` free of the environment. Next evaluates it at `next build` and again at `next start`, and the two runs see different environments. Anything derived from the environment there differs between build and run, so a value computed during the build doesn't match at run time. That is how a `deploymentId` read from the environment ended up making every navigation a full reload ([replicas.md](replicas.md)).

Standalone is acceptable only when `next.config.*` reads no environment at all. Even then it isn't the team default.

## Read settings per request, on the server

One server-only module reads the settings when called, never at module load ([assets/src/configs/runtime-config.ts](../assets/src/configs/runtime-config.ts)):

```ts
export function getRuntimeConfig(): RuntimeConfig {
  return {
    apiBaseURL: process.env.API_BASE_URL ?? "http://127.0.0.1:8080",
    appBaseURL: process.env.APP_BASE_URL ?? "http://127.0.0.1:3000",
    // ...
  };
}
```

- Call it from request-time code: `proxy.ts`, route handlers, server actions, and server components after `cookies()`/`headers()`/`connection()`. Never call it from module scope or from `next.config.*`.
- `proxy.ts` sends the backend's paths to `API_BASE_URL`, read on every request: `NextResponse.rewrite(backendURL(getRuntimeConfig().apiBaseURL, pathname, search))`. The `matcher` itself must be a static literal; keep it in step with the prefix list in code (`nextjs-bff`).
- `PORT` and `HOSTNAME` are read by `next start` itself.
- `.env.example` lists every setting with a comment, and says they are set on the container (no rebuild).
- `APP_ENV` (`development` / `staging` / `production`) is server-only. A process with `NODE_ENV=production` (any `next build` or `next start`) always counts as production.

## Values the browser needs

There are no `NEXT_PUBLIC_*` settings. The server reads the value per request and hands it over in one of two ways:

- **Server-rendered props or a provider:** a server component reads the setting and passes only that field to a client component.
- **A route handler** that answers the needed fields (the version page reads `build.json` this way).

Pick the fields one by one and never pass the whole config object, so no secret reaches the HTML.

## Check it

- `grep -rn "NEXT_PUBLIC_" app components src proxy.ts` finds nothing that differs per environment.
- `next.config.*` has no `process.env`.
- Start the same image twice with different `API_BASE_URL` values: `/readyz` and the proxied paths follow each one.
