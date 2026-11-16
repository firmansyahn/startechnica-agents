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

These commands build the image directly with the host's engine. They apply to local deployments as well as smoke checks; **kaniko, GitLab CI, Kubernetes and Helm aren't prerequisites**. Supply runtime settings through the engine's environment or secret mechanisms, keeping secret values out of the image and version control. The kaniko cache rationale above explains the shared Dockerfile's CI layout, not a required local builder.

On RHEL-family hosts (including Fedora, CentOS Stream, Rocky Linux, AlmaLinux and Oracle Linux), use **Podman**, preferably rootless. Run from the repo root; Podman builds the same Dockerfile and reads `.dockerignore` (if `.containerignore` also exists, Podman prefers it, so keep its exclusions aligned).

```sh
podman build -f <app>/shrine/Dockerfile.production --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t <app>:local .
podman run --rm -p 127.0.0.1:3000:3000 -e API_BASE_URL=http://host.containers.internal:8080 <app>:local
```

`host.containers.internal` is Podman's host alias; verify it resolves and the backend is reachable from the container with the host's networking setup. For bind mounts on SELinux-enforcing hosts, use `:Z` for a private container mount or `:z` for a deliberately shared mount on a dedicated project directory; don't disable SELinux or relabel system directories.

On other hosts where Docker is the chosen engine:

```sh
docker build -f <app>/shrine/Dockerfile.production --build-arg GIT_SHA=$(git rev-parse --short HEAD) -t <app>:local .
docker run --rm -p 127.0.0.1:3000:3000 -e API_BASE_URL=http://host.docker.internal:8080 <app>:local
```

On Docker Engine for Linux, add `--add-host=host.docker.internal:host-gateway` to `docker run` if that alias isn't supplied automatically. Neither local engine needs kaniko or changes the image entrypoint; if the project also has a kaniko CI build, it remains a separate build path.

Verify with either engine while the container is running (in another terminal):

```sh
curl -fsS localhost:3000/livez; curl -s localhost:3000/readyz      # readyz names the first missing setting
```

## Isolate deployments on the same host

For multiple copies of an app or unrelated stacks on one host, give each deployment its **own named user-defined network**. Attach only its frontend, API and other required services. Use scoped container names and volumes too: network separation doesn't prevent container-name collisions or isolate a shared data volume.

The following shell example uses Podman on RHEL-family hosts; set `engine=docker` on other Docker hosts. Replace the image placeholders and supply the API's required runtime configuration. Run all commands with the same engine and user (rootless Podman and rootful Podman have separate resources).

```sh
engine=podman
deployment=example-a
host_port=3001

"$engine" network create "${deployment}-net"
"$engine" run -d --name "${deployment}-api" \
  --network "${deployment}-net" --network-alias api <api-image>
"$engine" run -d --name "${deployment}-web" \
  --network "${deployment}-net" \
  -p "127.0.0.1:${host_port}:3000" \
  -e API_BASE_URL=http://api:8080 <app>:local
```

For a second stack, repeat with `deployment=example-b` and `host_port=3002`. Both APIs can use the alias `api` and internal port 8080 because their networks are distinct. The API must listen on its container interface, not just container loopback. Podman's user-defined network must have DNS enabled for aliases to resolve. Use the actual API port and protocol; don't hard-code container IPs. When the API is another container, prefer its network alias over routing through `host.containers.internal` or `host.docker.internal` and a published host port.

- **Publish only entrypoints.** Don't publish API, database or Redis ports unless host access is required. A published port can bypass the intended separation; keep local access bound to `127.0.0.1`, and choose a unique host port for each stack. Deliberate remote access needs an explicit bind address, firewall rules and authentication/TLS.
- **Reverse proxy:** a host proxy can use the distinct loopback ports. For a containerized proxy, attach it only to each stack's intended ingress network with unique upstream aliases; split ingress from private backend/data networks when the proxy must not reach those services. A shared proxy or shared network is an intentional trust connection, not isolation.
- **Compose:** give each stack a distinct project name and project-scoped networks and volumes. Avoid fixed global `container_name`, network `name` or volume `name` values shared by multiple projects; an `external` network is explicitly shared. Don't assume a Compose provider is installed with Podman; verify the project's provider before using it.
- **Egress:** ordinary user-defined networks normally allow outbound access. If services must have no external connectivity, consider a separate `--internal` network after checking the engine/version and required DNS, OAuth and backend access. Don't put a service that needs outbound access only on an internal network.
- **Limits:** these networks separate normal container traffic and service discovery, not hostile tenants. They don't isolate access through published host ports, the host itself, a privileged container or a mounted engine socket. For untrusted workloads, use stronger host/VM boundaries and enforced firewall policy; don't use `--network host` as an isolation shortcut.

### Verify the separation

1. Inspect each network with `podman network inspect <deployment>-net` (or `docker network inspect`) and each container's network attachments with the matching engine's `inspect`; confirm no unintended cross-stack attachments and, for Podman, that DNS is enabled.
2. From the web container, confirm its API alias resolves and an actual API request succeeds. Use the app's existing runtime or an approved diagnostic image on that network; don't install debugging tools into the production image. Confirm an alias unique to another stack doesn't resolve and direct access to that stack's private service fails. Probe the actual private endpoint, not a published host port, and don't treat DNS failure alone as proof of traffic isolation.
3. Confirm `/livez` and `/readyz` on each stack's distinct published entrypoint, then check with `podman port <container>` (or `docker port`) that only intended ports are exposed. Readiness alone doesn't prove the API is reachable: the probe validates configuration, so retain the real API request from step 2.
4. Before removal, inspect membership and stop/remove only that deployment's containers; then remove its network by its exact name. Don't use broad network or volume pruning on a shared host, and don't remove persistent volumes without separate confirmation.
