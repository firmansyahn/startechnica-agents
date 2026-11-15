---
name: nextjs-new-app
description: "Use when creating a new Next.js App Router app for the team, in its own folder beside a backend, as apps/<app-name>/ in a monorepo, or as a whole repo: pinning Yarn 4 with a committed release before create-next-app, the create-next-app flags, the folder layout and aliases, Tailwind v4 and shadcn on Base UI in components/shadcn-ui, the TanStack Query provider and services transport with Result/runAction, next-intl, the pino logger and instrumentation.ts, Vitest (node/dom) and Playwright, the review lint config and rule tests, runtime config and probes for a next start image, the Dockerfile and CI, AGENTS.md, .gitattributes and the first commit. Each step points at the skill that owns it."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# New Next.js app

**Principle:** A new app follows every team skill from its first commit, set up in order: Yarn is pinned before anything installs, and each step names the skill that owns it.

The steps below set up a new app that follows every team skill from its first commit. Each step names the skill that owns the detail, so read that skill when the step needs more than these commands. The order matters: Yarn is pinned before anything installs.

The flow was checked end to end with create-next-app 16.4.3, Yarn 4.18.1 and shadcn 4.23.0 (2026-11-13). The finished app typechecks, lints, passes its tests and builds, and `next start` serves `/livez`, `/readyz` and the home page from production dependencies only. Use versions at least two weeks old, and check a CLI's flags with `--help` when its version differs from these.

`<v>` below means a pinned version, never `latest`.

## 1. Choose `<app-root>` (`nextjs-app-structure`)

| Repo | App root |
|---|---|
| Next app beside a backend (Go, ...) | its own folder, `<app>/` |
| Yarn-workspaces monorepo | `apps/<app-name>/` (the root is already pinned; skip step 2 there) |
| Repo that is only the app | the repo root |

The steps run in `<app-root>`. The assets write the app's folder as `<app>/`: replace it with the folder's name, or drop the `<app>/` prefixes for an app at the repo root (`.gitattributes`, `.dockerignore`, the Dockerfile and CI).

## 2. Pin Yarn, then scaffold (`nextjs-package-manager`)

create-next-app refuses a folder that already holds `package.json` or `.yarnrc.yml`, but it accepts `.yarn/`. So fetch the Yarn release first, set those two files aside, and run the scaffold with the release itself:

```sh
mkdir <app> && cd <app>   # the app's folder; skip for an app at the repo root
yarn set version <yarn-v> --yarn-path        # from a Yarn 1.22 launcher, run it twice: the second run writes yarnPath
rm .yarnrc.yml package.json                  # keep .yarn/releases/yarn-<yarn-v>.cjs
node .yarn/releases/yarn-<yarn-v>.cjs dlx create-next-app@<next-v> . \
  --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" \
  --use-yarn --skip-install --disable-git --no-agent-feedback --yes
node .yarn/releases/yarn-<yarn-v>.cjs set version <yarn-v> --yarn-path   # writes yarnPath and packageManager again
printf 'nodeLinker: node-modules\nenableTelemetry: false\n' >> .yarnrc.yml
yarn install
```

- `--no-src-dir`: routes stay in `app/`, and `src/` holds shared code by kind (step 4).
- create-next-app 16.4 writes `AGENTS.md` with a `nextjs-agent-rules` block. Keep that block, because `next dev` adds it back. It also writes a `.gitignore` that already keeps `.yarn/releases`.
- Without any launcher on the machine, run `node .yarn/releases/yarn-<yarn-v>.cjs` wherever this skill says `yarn`.

## 3. `next.config` (`nextjs-deploy`)

Replace the generated `next.config.ts` with [assets/next.config.mjs](assets/next.config.mjs):

- No `output: "standalone"` and no `deploymentId`. The team runs `next start`, which loads this file again at startup.
- No `process.env` in the file.
- It drops the `cacheComponents: true` and `partialPrefetching: true` that create-next-app 16.4 adds. The team's apps don't use Cache Components, and the probes and per-request settings in `nextjs-deploy` assume they are off. Turning them on later is a deliberate migration (`migrating-to-cache-components.md` in the Next docs).
- It sets `typescript.ignoreBuildErrors`, because CI runs `yarn typecheck` before the build.
- It keeps `pino` external, and keeps create-next-app's Turbopack Tailwind rule.

## 4. Folders and aliases (`nextjs-app-structure`)

Set the `paths` in `tsconfig.json` (`@/libs/*`, `@/hooks/*`, `@/services/*`, `@/schemas/*`, `@/types/*`, `@/providers/*`, `@/utils/*`, `@/constants/*`, then `@/*`), as in `nextjs-app-structure` references/folders.md. Create folders as their first file arrives.

## 5. Tailwind v4 and shadcn on Base UI (`nextjs-ui`)

```sh
yarn dlx shadcn@<shadcn-v> init -b base -p nova -y --no-monorepo
```

`init` ignores the existing folders. It writes `components.json` with shadcn's default aliases and creates `lib/utils.ts`. Point it at the team's folders before adding any component:

```json
"rsc": true,
"aliases": { "components": "@/components", "ui": "@/components/shadcn-ui", "utils": "@/libs/utils", "lib": "@/libs", "hooks": "@/hooks" }
```

```sh
mkdir -p src/libs && git mv lib/utils.ts src/libs/utils.ts 2>/dev/null || mv lib/utils.ts src/libs/utils.ts; rmdir lib
yarn dlx shadcn@<shadcn-v> add button dialog field input sonner      # lands in components/shadcn-ui/
```

- `-b base` selects Base UI, and `-p nova` picks the preset, so init doesn't stop at a prompt.
- Current shadcn components import `cn` from the `cn` package (shadcn's own clsx + tailwind-merge replacement), so `src/libs/utils.ts` is just `export { cn } from "cn"`. That is expected, not a broken alias.
- `init` adds `shadcn` itself to `dependencies`. Move it to `devDependencies`: it is a CLI, and the runtime image installs production dependencies only.
- Theme mechanism: the layout asset uses `next-themes` (mechanism A in `nextjs-ui` references/themes.md), which the sonner primitive needs.

## 6. Dependencies

```sh
yarn add @tanstack/react-query zod react-hook-form @hookform/resolvers next-intl pino server-only
yarn add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom \
  @testing-library/user-event @testing-library/jest-dom vite-tsconfig-paths @playwright/test pino-pretty   eslint-plugin-testing-library eslint-plugin-playwright axe-core
```

## 7. Copy the skeleton

| Asset | To | Owner |
|---|---|---|
| [assets/app/layout.tsx](assets/app/layout.tsx), [page.tsx](assets/app/page.tsx), [HomeClient.tsx](assets/app/HomeClient.tsx), [page.test.tsx](assets/app/page.test.tsx), [global-error.tsx](assets/app/global-error.tsx) | `app/` | `nextjs-app-structure` (thin server page + client component, a test beside each page), `nextjs-logging` (the last-resort error page) |
| [assets/src/providers/QueryProvider.tsx](assets/src/providers/QueryProvider.tsx) | `src/providers/` | `nextjs-data` |
| [assets/src/services/client.ts](assets/src/services/client.ts) | `src/services/` (`serviceKey`, `read`, `runAction`) | `nextjs-data` |
| [assets/src/api/result.ts](assets/src/api/result.ts) | `src/api/` (`Result`, `ApiError`, `fromEnvelope`) | `go-nextjs-api-contract`, `nextjs-bff` |
| [assets/src/i18n/request.ts](assets/src/i18n/request.ts), [assets/src/messages/en.json](assets/src/messages/en.json) | `src/i18n/`, `src/messages/` | `nextjs-app-structure` Strings rules |
| [assets/src/libs/logger.ts](assets/src/libs/logger.ts), [logger.test.ts](assets/src/libs/logger.test.ts), [assets/instrumentation.ts](assets/instrumentation.ts) | `src/libs/`, `<app-root>/` | `nextjs-logging` |
| The `README.md` in each `assets/src/<kind>/` | each `src/<kind>/` | `nextjs-app-structure` (`struct-src-folder-readme`) |
| [assets/vitest.config.ts](assets/vitest.config.ts), [assets/tests/setup-dom.ts](assets/tests/setup-dom.ts), [assets/tests/render.tsx](assets/tests/render.tsx) | `<app-root>/`, `tests/` (`renderWithQuery`, `fakeApi`) | `nextjs-app-structure` references/testing.md |

Adjust `READS_BASE` and the sign-in path in `src/services/client.ts` to the app's.

## 8. Runtime settings, probes and the image (`nextjs-deploy`)

Copy from `nextjs-deploy/assets/`:

- `src/configs/runtime-config.ts` and `src/configs/README.md`
- `src/libs/health.ts`, `app/livez/route.ts`, `app/readyz/route.ts`
- `src/libs/build.ts`
- `Dockerfile` → `<app>/shrine/Dockerfile.production`, and the same file without the `NODE_ENV=production` line → `<app>/shrine/Dockerfile.default`
- `dockerignore` → `<repo>/.dockerignore`
- `ci/root.gitlab-ci.yml` and `ci/nextjs.gitlab-ci.yml`

Then:

- Write `.env.example` listing every setting the config reads.
- Adapt `readiness()` to the settings this app needs.

## 9. Backend access, only if the app talks to an OAuth-protected backend (`nextjs-bff`)

Add the rest of `src/api/` (session store, OAuth flow, forwarding, `apiAction`), the reads proxy route, `proxy.ts` rewrites and gate, and the generated API types (`gen:api`, `go-nextjs-api-contract`). This skill doesn't scaffold them. Follow `nextjs-bff`, and `oauth-client` references/web-bff-client.md for the sign-in flow.

## 10. Playwright (`nextjs-e2e`)

Copy `nextjs-e2e/assets/playwright.config.ts` and set its `webServer` to the app's start command and health route (`/livez`). Specs go in `tests/e2e/`. Add `/**/__screenshots__/ @<team>` to `CODEOWNERS` and require code-owner approval (`e2e-review-baseline-updates`), and keep the CI job's Playwright image at the installed `@playwright/test` version.

## 11. Enforcement ([references/enforcement-kit.md](references/enforcement-kit.md))

- `nextjs-new-app/assets/eslint.config.mjs` → `<app-root>/eslint.config.mjs`. It replaces the generated config and includes Next's.
- `nextjs-ui/assets/tests/{theme-tokens,size-shorthand}.test.ts` and `axe.ts` → `tests/`.
- `nextjs-bff/assets/tests/server-only.test.ts` → `tests/`.
- `nextjs-data/assets/tests/{no-effect-fetch,use-server-exports,action-calls,optimistic-updates,stores}.test.ts` → `tests/`.
- `nextjs-app-structure/templates/{locale-parity,metadata-translated,src-layout,test-layout,page-tests}.test.ts` → `tests/`.
- `nextjs-security/assets/tests/route-handlers.test.ts` and `nextjs-e2e/assets/tests/e2e-setup.test.ts` → `tests/`.
- `nextjs-security/assets/e2e/security-headers.spec.ts` and `nextjs-e2e/assets/layout.spec.ts` → `tests/e2e/`, with the app's pages in their settings.

The opt-in tests (the access map, the form overlay, the client-error endpoint) go in once the app has what they check; the enforcement kit lists them. The skeleton passes all of the default set and lints clean. Every module that imports `next/headers` or `node:*` starts with `import "server-only"`.

## 12. Scripts, repo files, first commit

`package.json` scripts:

```json
"dev": "next dev", "build": "next build", "start": "next start", "lint": "eslint",
"typecheck": "tsc --noEmit", "test": "vitest run", "test:e2e": "playwright test"
```

Add `gen:api` with step 9.

- Merge [assets/gitattributes](assets/gitattributes) into the repo's `.gitattributes`: LF everywhere, and the Yarn release marked binary.
- Copy [assets/AGENTS.md](assets/AGENTS.md) below the generated `nextjs-agent-rules` block, then fill in the app's name and reference pages.
- Add a `CLAUDE.md` containing `@AGENTS.md`.

Verify, in this order:

```sh
yarn install --immutable     # yarn.lock is committed and current
yarn typecheck && yarn lint && yarn test && yarn build
yarn start &                 # then: curl -s localhost:3000/livez; curl -s localhost:3000/readyz; open /
```

`/readyz` answers 503 naming `REDIS_URL` when `NODE_ENV=production` has no session store. That is expected until the settings are set.

Commit by name, never `git add -A`. Include `.yarn/releases/yarn-<yarn-v>.cjs`, `.yarnrc.yml`, `yarn.lock`, `package.json` and the app files, and leave out `.env*`. Use a Conventional Commit message: `feat(web): scaffold the Next.js app`.

## Checklist

- [ ] Yarn pinned by the committed release; `yarn --version` in the app prints it; one lockfile
- [ ] `next.config.mjs` from the asset: no standalone, no `deploymentId`, no `process.env`, no Cache Components
- [ ] Aliases set; `components.json` points at `components/shadcn-ui` and `@/libs/utils`; `shadcn` in devDependencies
- [ ] Skeleton, runtime config, probes, Dockerfiles, CI, lint config and rule tests copied
- [ ] `typecheck`, `lint`, `test`, `build` pass; `next start` serves `/livez` and `/readyz`
- [ ] `AGENTS.md` (with the generated block), `CLAUDE.md`, `.gitattributes`, `.env.example` committed
