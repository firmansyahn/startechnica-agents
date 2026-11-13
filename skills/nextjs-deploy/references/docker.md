# Docker image

Start from [assets/Dockerfile](../assets/Dockerfile) and [assets/dockerignore](../assets/dockerignore) (copy it to the repo root as `.dockerignore`). The image runs `next start` on the app's normal build. It is not `output: "standalone"`.

## Where the files go

```
<repo>/
  .dockerignore                    the build context is the repo root
  <app>/
    shrine/Dockerfile.production   the image the production tier builds
    shrine/Dockerfile.default      every other tier (the CI template falls back to it)
    shrine/Dockerfile.local        optional: the same stages with defaults, for a local compose stack
```

The CI template builds `<app>/shrine/Dockerfile.<tier>` and uses `Dockerfile.default` when that file doesn't exist ([ci.md](ci.md)). The two differ in one line on purpose: **only `Dockerfile.production` sets `NODE_ENV=production`** in the runner's `ENV`; `Dockerfile.default` (every other tier) leaves it out. Everything else stays identical. The asset is the production file: for `.default`, copy it and drop the `NODE_ENV=production \` line.

`next start` itself sets `NODE_ENV` to `production` when it is unset, so the Next server runs in production mode in both images; the `ENV` line decides what every other process in the container sees (a `node` script run with `kubectl exec`, a debugging shell).

## The stages

| Stage | `FROM` | Does |
|---|---|---|
| `deps` | `node:<v>-trixie-slim` | Copies `package.json`, `yarn.lock`, `.yarnrc.yml` and `.yarn/releases`, then runs `yarn install --immutable`. These are all dependencies, used for the build |
| `prod-deps` | `node:<v>-trixie-slim` | Copies the same files, then runs `yarn workspaces focus --production`, which installs runtime dependencies only |
| `builder` | `deps` | Copies `<app>/` and runs `yarn build` without any runtime setting. Then it writes `build.json` from the `APP_VERSION` and `GIT_SHA` build arguments |
| `runner` | `node:<v>-trixie-slim` | Sets `NODE_ENV=production` (production tier only), `NEXT_TELEMETRY_DISABLED=1`, `PORT=3000` and `HOSTNAME=0.0.0.0`, and creates the system user `startechnica` (uid/gid 14918). It copies the production `node_modules`, `package.json`, `build.json`, `next.config.mjs`, `src`, `.next` and `public`, then runs `node node_modules/next/dist/bin/next start` |

Why this shape:

- **Both dependency stages start from the Node image.** Kaniko keys a stage that is built on another stage by that stage's image digest. A `COPY` layer's digest changes with every checkout, because the files' times change, so a shared base stage would miss the install cache every time. Starting both stages from the Node image keys each install by the manifests' content.
- **`build.json` is written after `yarn build`,** so a new commit (a new `GIT_SHA`) doesn't invalidate the build layer. The server reads it when asked (`src/libs/build.ts` in the assets). Version strings never go through `NEXT_PUBLIC_*`.
- **`next start`, not standalone.** `next start` loads `next.config.*` again when the container starts, so the config sees the runtime environment. Standalone serialises the evaluated config into `server.js` at build time ([runtime-config.md](runtime-config.md)).
- **The Next binary runs directly as PID 1:** `node node_modules/next/dist/bin/next start`. The runtime image has no Yarn, and `SIGTERM` reaches Next's own shutdown handler, which finishes in-flight requests and exits with 143.
- **Production dependencies only** in the runner. `yarn workspaces focus --production` works in a single-package project too; it installs the current workspace's `dependencies`. Keep build-only tools in `devDependencies`. `shadcn init` adds the `shadcn` CLI to `dependencies`, so move it to `devDependencies`, or the CLI and its compilers ship in every image.
- **Non-root:** every image runs as the org's fixed system user `startechnica` with uid 14918 and gid 14918 (`groupadd --system --gid 14918 startechnica` and `useradd --system --uid 14918 --gid startechnica --home-dir /app --no-create-home startechnica`, Debian syntax), then `USER startechnica`. The same ids in every image keep file ownership and the chart's `runAsUser`/`runAsGroup` consistent.

## Yarn in the image: committed release, not Corepack

The Dockerfile copies `<app>/.yarn/releases` and runs `node .yarn/releases/yarn-*.cjs ...`, as `nextjs-package-manager` requires: the release committed in the repo and named by `yarnPath`. It works on any Node version without Corepack. The glob relies on exactly one file in `.yarn/releases/`.

An image that still gets Yarn through Corepack (`ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0`, `RUN corepack enable`, `yarn ...`) works on Node 24, but Node 25 and later no longer bundle Corepack. Move it to the committed release when the project is converted (`nextjs-package-manager` section 4).

## `.dockerignore`

The context is the repo root, so the ignore file lives there. It keeps out `.git`, large or private folders (captures, artifacts, docs), the app's `node_modules`, `.next`, `.env*` (except `.env.example`), test reports, `tsconfig.tsbuildinfo`, and Yarn's local state (`<app>/.yarn/*` except `releases`).

## Monorepo (`apps/<app-name>/`)

The same stages apply, with these changes:

- Copy the root `package.json`, `yarn.lock`, `.yarnrc.yml`, `.yarn/releases` and every workspace's `package.json` that the app depends on.
- Install with `yarn workspaces focus <app>`, adding `--production` in `prod-deps`.
- Build with `yarn workspace <app> build`.

This layout isn't used by the team yet.

## Check an image locally

```sh
docker build -f <app>/shrine/Dockerfile.production --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t <app>:local .
docker run --rm -p 3000:3000 -e API_BASE_URL=http://host.docker.internal:8080 <app>:local
curl -fsS localhost:3000/livez; curl -s localhost:3000/readyz      # readyz names the first missing setting
```
