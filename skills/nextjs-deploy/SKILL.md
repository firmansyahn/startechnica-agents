---
name: nextjs-deploy
description: "Use when building, containerising, deploying or running a Next.js App Router app: `next start` (not standalone), production-only dependencies, runtime settings (no NEXT_PUBLIC_ settings or environment-dependent next.config), the multi-stage Dockerfile (deps, prod-deps, builder, runner, build.json), .dockerignore, probes, Redis sessions, version skew and server-action limits. Local deployments build directly with Podman on RHEL-family hosts or Docker elsewhere, without requiring kaniko, GitLab CI, Kubernetes or Helm. The team's GitLab CI path uses kaniko from the repo root and releases through a chart repository. Also when asked why not standalone, or what the Helm chart must set."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# Deploying Next.js

**Principle:** The same image runs `next start` in every environment, and every setting arrives at container runtime, never at build time.

The team runs each Next.js app as a container that starts `next start` on the app's normal build. **Choose the deployment path before applying the CI guidance:** local deployments build directly with the host's container engine and supply settings at runtime; they don't require kaniko, GitLab CI, Kubernetes or Helm. In the team's GitLab CI path, one image is built per commit by kaniko and released by bumping a Helm chart in a separate repository; Kubernetes injects settings when the pod starts.

```
local ─► podman build (RHEL family) / docker build (other Docker hosts)
         └─ run the image with runtime settings; no kaniko or chart release required

push ─► root .gitlab-ci.yml: branch → tier (production | staging | testing | development | other)
        └─ <app>/.gitlab-ci.yml: install ─ typecheck ─ lint (MRs) ─ [test, playwright: manual]
                               build (kaniko, Dockerfile.<tier>) ─► release (trigger chart repo on the tier's branch)
pod  ─► node node_modules/next/dist/bin/next start   (env from ConfigMap/Secret, read per request)
```

Related: `nextjs-package-manager` (Yarn 4 from the committed release), `nextjs-bff` (sessions in Redis, `proxy.ts` rewrites), `nextjs-logging` (JSON to stdout), `nextjs-data` (server actions, `runAction`'s reload message), `nextjs-new-app` (a new app starts with this setup). Check facts against the installed Next docs (`node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`).

**Host container engine:** on RHEL-family hosts (RHEL, Fedora, CentOS Stream, Rocky Linux, AlmaLinux and Oracle Linux), use Podman instead of Docker for local builds, runs and image checks, preferably rootless. Build the Dockerfile directly with `podman build` (or `docker build` on other Docker hosts), using the repo root as context and `.dockerignore`. No kaniko step is needed locally; an existing kaniko CI build can stay unchanged. See [the local image check](references/docker.md#check-an-image-locally) for engine-specific commands.

**Several deployments on one host:** use a separate named Podman/Docker network per deployment when isolating its services from other stacks. Connect only that deployment's containers, use network aliases for service-to-service traffic and publish only the intended entrypoint on a distinct host port (or route through a reverse proxy). Don't use host networking or a shared default network for this separation. See [per-deployment networks](references/docker.md#isolate-deployments-on-the-same-host) for examples and isolation limits.

## Read the reference for the task

| Task | Reference |
|---|---|
| The Dockerfile's stages and why, `.dockerignore`, Yarn in the image, checking an image | [references/docker.md](references/docker.md) |
| Why `next start` and not standalone, what `next build` freezes, reading settings per request, values the browser needs | [references/runtime-config.md](references/runtime-config.md) |
| Probes, sessions across replicas, version skew, server-action settings, shutdown, what's not in use yet | [references/replicas.md](references/replicas.md) |
| The pipeline: tier rules, jobs, the org templates, kaniko flags | [references/ci.md](references/ci.md) |
| What the Helm chart must set | [references/chart.md](references/chart.md) |

## Files to copy

| Asset | Put it at |
|---|---|
| [assets/Dockerfile](assets/Dockerfile) | `<app>/shrine/Dockerfile.production` and `<app>/shrine/Dockerfile.default` |
| [assets/dockerignore](assets/dockerignore) | `.dockerignore` at the repo root (the build context) |
| [assets/app/livez/route.ts](assets/app/livez/route.ts), [assets/app/readyz/route.ts](assets/app/readyz/route.ts), [assets/src/libs/health.ts](assets/src/libs/health.ts) | `<app>/app/livez/`, `<app>/app/readyz/`, `<app>/src/libs/` |
| [assets/src/configs/runtime-config.ts](assets/src/configs/runtime-config.ts) | `<app>/src/configs/` (adapt the settings) |
| [assets/src/libs/build.ts](assets/src/libs/build.ts) | `<app>/src/libs/` (reads `build.json` for a version page) |
| [assets/ci/root.gitlab-ci.yml](assets/ci/root.gitlab-ci.yml), [assets/ci/nextjs.gitlab-ci.yml](assets/ci/nextjs.gitlab-ci.yml) | `.gitlab-ci.yml`, `<app>/.gitlab-ci.yml` (fill in `<org>`, `<app>`, the chart path and the runner tag). The app file includes `nextjs-security`'s `assets/ci/security.gitlab-ci.yml` (→ `<app>/`) with its two scripts (→ `<app>/scripts/ci/`) |

## Rules

1. **`next start`, never `output: "standalone"`.** Standalone writes the evaluated `next.config.*` into `server.js` at build time. `next start` loads it again when the container starts. The container launches Next with exactly this line, and nothing else:

   ```dockerfile
   ENTRYPOINT [ "node", "node_modules/next/dist/bin/next", "start" ]
   ```

   Exec form, the Next binary as PID 1, so `SIGTERM` reaches Next's own shutdown. Never `CMD ["yarn", "start"]`, `npm start`, a shell-form entrypoint, a wrapper script, or `node server.js`. `PORT` and `HOSTNAME` come from the environment; a chart passes extra flags (`--keepAliveTimeout`) as `args`, which Docker appends to this entrypoint.
2. **Nothing environment-dependent at build:** no `process.env` in `next.config.*`, no `NEXT_PUBLIC_*` settings, no runtime settings in the Dockerfile. Settings are read per request from one server-only module.
3. **The image:** both dependency stages start `FROM` the Node image (kaniko cache keying); `builder` builds on `deps`; `build.json` is written after the build; the runner has production dependencies only, runs as the system user `startechnica` (uid 14918, gid 14918), and its entrypoint is the one in rule 1, with no Yarn.
4. **Yarn from the committed release** (`node .yarn/releases/yarn-*.cjs`), in the Dockerfile and in CI (`nextjs-package-manager`).
5. **Probes answer from the process alone:** `/livez` always 200; `/readyz` 503 naming the first missing or invalid setting (backend URL, and in production the session store and the OAuth secret).
6. **Replicas share sessions through Redis**; no `deploymentId`; Server Action limits sized in `next.config.mjs`.
7. **Match the build and release path to the deployment.** Locally, build directly with Podman on RHEL-family hosts or Docker on other Docker hosts; supply settings at runtime without requiring kaniko or a chart release. For the team's GitLab CI path, the pipeline decides the tier from the branch, checks run in merge requests, the image is built by the org's kaniko template and released by triggering the chart repository. Copy the CI assets only when setting up that path.

## Checklist

- [ ] No `output: "standalone"`, no `deploymentId`, no `process.env` in `next.config.*`; no `NEXT_PUBLIC_*` settings
- [ ] `Dockerfile.production` and `.default` from the asset, identical except that only `.production` sets `NODE_ENV=production`; `.dockerignore` at the repo root
- [ ] The runner image has no Yarn and no dev dependencies (`shadcn` moved to `devDependencies`) and runs as `startechnica` (uid/gid 14918)
- [ ] Local images built directly with Podman on RHEL-family hosts or Docker on other Docker hosts; no kaniko, CI or Helm prerequisite
- [ ] Co-located stacks needing separation have distinct named networks, container names, volumes and host ports; only intended entrypoints are published, and network membership and cross-stack reachability are checked
- [ ] `/livez` and `/readyz` in place and checked locally (also used by the chart on Kubernetes); `.env.example` lists every setting
- [ ] Runtime secrets stay out of the image and version control; on Kubernetes, `REDIS_URL` and the OAuth secret come from a Secret in every deployed tier
- [ ] When using the team's GitLab CI path: root and web CI files from the assets; `gen:api --check`, typecheck and lint pass in the merge request
