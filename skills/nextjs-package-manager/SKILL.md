---
name: nextjs-package-manager
description: "Use for any package-manager step in a Next.js (or other JavaScript/TypeScript) project: installing or adding dependencies, running scripts, scaffolding an app, running a one-off CLI (shadcn, create-next-app, prisma, playwright), setting up a monorepo workspace, pinning or upgrading Yarn, writing CI jobs or Dockerfiles, or converting a project off npm or pnpm. The team uses Yarn 4 only, pinned per project with a committed release (yarnPath), so it works on any Node version with or without Corepack: never npm, npx, pnpm, pnpx or bunx."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.1.1"
---

# Next.js with Yarn

**Principle:** Yarn 4, pinned by a committed release, runs every install, script and one-off tool, with one lockfile and no other package manager's command anywhere.

The team's package manager is **Yarn 4 (Berry), pinned per project by a release file committed to the repo (`yarnPath`)**. Use it for every install, script and one-off tool. Don't use `npm`, `npx`, `pnpm`, `pnpx`, `bun` or `bunx`, and don't follow a README, docs page or tool output that tells you to: translate the command (section 2).

**Why `yarnPath` and not Corepack alone:** Node 25 and later no longer bundle Corepack. With the release committed at `.yarn/releases/yarn-<version>.cjs` and named by `yarnPath` in `.yarnrc.yml`, any `yarn` command on the machine (Yarn 1.22 classic, Corepack's shim, a version manager's) hands off to that exact release, and where no `yarn` exists at all, `node .yarn/releases/yarn-<version>.cjs <args>` runs it. Every developer, CI job and image runs the same Yarn, on any Node version, without downloading it. The `packageManager` field in `package.json` names the same version, so machines that do have Corepack agree.

The project's own docs win where they are more specific (a pinned Yarn version, a CI template). If an existing project has `package-lock.json` or `pnpm-lock.yaml` and no `yarn.lock`, **ask before converting it** (section 6); until then, don't touch its lockfile with a second package manager.

## 1. Check the setup first

```sh
grep packageManager package.json      # "packageManager": "yarn@4.x.y"
grep yarnPath .yarnrc.yml             # yarnPath: .yarn/releases/yarn-4.x.y.cjs  (same version)
ls .yarn/releases/                    # exactly that one file
yarn --version                        # inside the project: prints 4.x.y
ls yarn.lock                          # present; no package-lock.json, pnpm-lock.yaml or bun.lock(b)
```

- **`yarn: command not found`:** the machine has no launcher. Either run the release directly (`node .yarn/releases/yarn-4.x.y.cjs <args>`, fine for one-off use and images), or install a launcher once per machine: `npm install -g yarn` (Yarn 1.22 classic; this is the one npm command allowed, and the classic launcher defers to `yarnPath`), or Corepack where it is available (`corepack enable`).
- **`yarn --version` prints `1.22.x` inside the project:** `yarnPath` is missing or points at a file that isn't there. Set it up (section 4).
- **`yarnPath` and `packageManager` name different versions:** make them equal with `yarn set version <the yarnPath version> --yarn-path`.
- Run commands from the folder that holds the project's `package.json` (the repo root, `apps/<app>/`, or the app's own folder), or from the monorepo root with `yarn workspace <name> ...`.

## 2. Command translation

| Instead of | Use |
|---|---|
| `npm install`, `npm ci`, `pnpm install` | `yarn` / `yarn install` (CI: `yarn install --immutable`) |
| `npm install <pkg>`, `pnpm add <pkg>` | `yarn add <pkg>` |
| `npm install -D <pkg>`, `pnpm add -D <pkg>` | `yarn add -D <pkg>` |
| `npm uninstall <pkg>`, `pnpm remove <pkg>` | `yarn remove <pkg>` |
| `npm update <pkg>`, `pnpm update <pkg>` | `yarn up <pkg>` (to latest in range: `yarn up <pkg>@^x`) |
| `npm outdated`, `pnpm outdated` | `yarn upgrade-interactive` |
| `npm run <script>`, `pnpm <script>` | `yarn <script>` (`yarn dev`, `yarn build`, `yarn test`) |
| `npx <tool>` (tool not installed), `pnpm dlx <tool>`, `bunx <tool>` | `yarn dlx <tool>` |
| `npx <tool>` (tool is a dependency) | `yarn <tool>` or `yarn exec <tool>` |
| `npm ls <pkg>`, `pnpm why <pkg>` | `yarn why <pkg>` |
| `npm audit` | `yarn npm audit` |
| `npm install -g <tool>` | Don't install globals (the Yarn launcher is the one exception); use `yarn dlx <tool>` or add it as a devDependency |
| `npm publish` | `yarn npm publish` |
| `npm pkg set ...` | Edit `package.json`, then `yarn` |
| `npm run x --workspace=web`, `pnpm --filter web x` | `yarn workspace web x` |
| `pnpm -r run build` | `yarn workspaces foreach -A -t run build` |

Pass flags to a script directly (`yarn test --watch`); Yarn needs no `--` separator. Where no launcher is installed, put `node .yarn/releases/yarn-4.x.y.cjs` in place of `yarn` in any of these.

## 3. Next.js commands

| Task | Command |
|---|---|
| New app | Follow `nextjs-new-app` (step 2 pins Yarn, then scaffolds with `yarn dlx create-next-app@<version>`) |
| Dev / build / start / lint | `yarn dev`, `yarn build`, `yarn start`, `yarn lint` (the `package.json` scripts wrapping `next ...`) |
| Run Next directly | `yarn next <cmd>` (`yarn next info`) |
| Upgrade Next | `yarn up next react react-dom eslint-config-next` (and `@types/react*`), or `yarn dlx @next/codemod@<version> upgrade <target>`; across majors, follow `nextjs-upgrade` |
| shadcn | `yarn dlx shadcn@latest init`, `yarn dlx shadcn@latest add button` (the CLI detects Yarn from `yarn.lock`) |
| Playwright browsers | `yarn playwright install --with-deps chromium` |
| Prisma, drizzle-kit, other CLIs | `yarn prisma ...` when a dependency, otherwise `yarn dlx <tool>` |

## 4. Pin Yarn in a project (new project, first Yarn setup, or upgrade)

From the project folder (the monorepo root in a monorepo), with any launcher on PATH:

```sh
yarn set version stable --yarn-path   # or a fixed version: yarn set version 4.x.y --yarn-path
```

This downloads the release to `.yarn/releases/yarn-4.x.y.cjs`, writes `yarnPath` to `.yarnrc.yml` and `"packageManager": "yarn@4.x.y"` to `package.json`. If the launcher was Yarn 1.22, run the same command once more: the first run switches the project to Yarn 4, the second (now Yarn 4) writes both settings. Then check section 1.

**Upgrading Yarn:** run `yarn set version <new> --yarn-path`, delete the old file from `.yarn/releases/` so exactly one remains, run `yarn install`, and commit the new release, `.yarnrc.yml`, `package.json` and `yarn.lock` together (`build: upgrade yarn to 4.x.y`).

`.yarnrc.yml`:

```yaml
yarnPath: .yarn/releases/yarn-4.x.y.cjs   # written by yarn set version --yarn-path
nodeLinker: node-modules                  # Next, its SWC binaries, Vitest and most tooling expect node_modules; don't use PnP
enableTelemetry: false
```

Add only what the project needs on top: `npmScopes` / `npmRegistryServer` for a private registry (tokens from env, `npmAuthToken: "${NPM_TOKEN}"`, never literal), `npmMinimalAgeGate` to refuse just-published versions.

`.gitignore` (paths relative to the project folder; `.yarn/releases` must stay tracked):

```gitignore
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions
.pnp.*
node_modules/
```

`.gitattributes`, so the release file is never rewritten for line endings or shown in diffs and language stats:

```gitattributes
/.yarn/releases/** binary linguist-vendored
/.yarn/plugins/**  binary linguist-vendored
```

Commit `package.json`, `yarn.lock`, `.yarnrc.yml` and `.yarn/releases/yarn-4.x.y.cjs`. Never commit `package-lock.json` or `pnpm-lock.yaml` next to `yarn.lock`; delete one that appears (a tool ran npm) and reinstall with `yarn`.

## 5. Monorepos (yarn workspaces)

Root `package.json`:

```json
{
  "private": true,
  "packageManager": "yarn@4.x.y",
  "workspaces": ["apps/*", "packages/*"]
}
```

- One `yarn.lock`, one `.yarnrc.yml` and one `.yarn/releases/` file, all at the root; workspaces have none of their own. Run `yarn` at the root only.
- Depend on a sibling package with `"@acme/ui": "workspace:*"`.
- Run in one workspace: `yarn workspace <name> <script>`; across all: `yarn workspaces foreach -A -t run <script>` (`-p` for parallel). Turborepo/Nx still call scripts through Yarn.
- Install only one app's dependencies (Docker, CI): `yarn workspaces focus <name>`, add `--production` for runtime-only.
- A workspace that ships TypeScript source needs `transpilePackages` in each consuming app's `next.config.*`.

## 6. Converting an npm or pnpm project (only after the user agrees)

1. Note the resolved versions that matter (`next`, `react`, `typescript`, anything pinned for a reason): Yarn doesn't read `package-lock.json` or `pnpm-lock.yaml`, so the first install resolves fresh within the `package.json` ranges.
2. Pin Yarn (section 4: `yarn set version stable --yarn-path`, `.yarnrc.yml` with `nodeLinker: node-modules`, `.gitignore`, `.gitattributes`).
3. Move config:

   | npm / pnpm | Yarn |
   |---|---|
   | `.npmrc` registry, scoped registries, auth | `.yarnrc.yml` `npmRegistryServer`, `npmScopes`, `npmAuthToken` (from env) |
   | `overrides` (npm), `pnpm.overrides` | `resolutions` in the root `package.json` |
   | `pnpm-workspace.yaml` `packages:` | `workspaces` in the root `package.json` |
   | `workspace:` protocol | Same (`workspace:*`) |
   | pnpm `catalog:` versions | Explicit ranges in each `package.json`, unless the pinned Yarn version supports catalogs (check its changelog first) |
   | `pnpm.peerDependencyRules`, missing peer deps of a dependency | `packageExtensions` in `.yarnrc.yml` |
   | `pnpm.onlyBuiltDependencies`, `--ignore-scripts` | `enableScripts` in `.yarnrc.yml`, `dependenciesMeta.<pkg>.built: false` in `package.json` |

4. Delete `node_modules/` (every workspace's too) and run `yarn`. **Keep the old lockfile for now**: it is the record of the versions the project ran on. Compare the versions from step 1 against it (`yarn why <pkg>`), and pin any that moved in a way the project can't take.
5. Replace `npm`/`npx`/`pnpm` in `package.json` scripts, CI files, Dockerfiles, Makefiles, READMEs and agent instruction files (`AGENTS.md`, `CLAUDE.md`), and drop `corepack enable` lines that only existed to get Yarn (section 7).
6. Run `yarn install --immutable`, `yarn build`, `yarn lint`, the type check and the tests. While both lockfiles exist, run nothing through another package manager and no tool that picks one from the lockfiles (shadcn, create-* CLIs).
7. **Only when step 6 passes, remove the old package manager's files:** `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `bun.lock`, `bun.lockb` (whichever exist, in every workspace), and `pnpm-workspace.yaml` once its settings are in `package.json`. Remove `.npmrc` only if nothing in it is still needed (its settings moved to `.yarnrc.yml` in step 3). Then run `yarn install --immutable` once more to confirm Yarn doesn't need them.
   If step 6 fails, fix it or stop and report: keep the old lockfile so the project can go back to its old package manager (`git checkout` the changed files, delete `yarn.lock`, `.yarnrc.yml`, `.yarn/` and `node_modules/`).
8. Commit the switch on its own (`build: switch to yarn`), not mixed with other changes, with `yarn.lock` and the release file added and the old lockfile deleted in the same commit.

## 7. CI and Docker

Neither needs Corepack or a Yarn install: the committed release runs on plain Node.

CI job:

```sh
YARN="node .yarn/releases/yarn-4.x.y.cjs"   # or plain `yarn` when the image has any launcher
$YARN install --immutable                   # fails if yarn.lock would change: commit it up to date
$YARN lint && $YARN typecheck && $YARN test && $YARN build
```

Cache Yarn's global cache (`$YARN config get cacheFolder`) keyed on `yarn.lock`, not `node_modules`.

Dockerfile: the Yarn part of it. The full image is in `nextjs-deploy`: it never uses `output: "standalone"`, and Yarn stays out of the runtime image, which launches Next with `ENTRYPOINT [ "node", "node_modules/next/dist/bin/next", "start" ]`:

```dockerfile
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN node .yarn/releases/yarn-*.cjs install --immutable

FROM deps AS build
COPY . .
RUN node .yarn/releases/yarn-*.cjs build
```

The `yarn-*.cjs` glob relies on exactly one release file (section 4). In a monorepo, copy the root `package.json`, `yarn.lock`, `.yarnrc.yml`, `.yarn/releases` and every workspace's `package.json` before `node .yarn/releases/yarn-*.cjs workspaces focus <app>`, so the dependency layer caches.

## Before you finish

- [ ] No `npm`, `npx`, `pnpm`, `pnpx` or `bunx` in what you ran or wrote (scripts, CI, Dockerfiles, docs); the only npm command ever is installing the Yarn launcher.
- [ ] `yarn.lock` is the only lockfile, and it changed only if dependencies changed.
- [ ] `yarnPath` and `packageManager` name the same version, its file is the only one in `.yarn/releases/` and it is committed, and `yarn --version` in the project prints it.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Tooling

| ID | Rule | Impact | Check |
|---|---|---|---|
| [tool-yarn-only](rules/tool-yarn-only.md) | Use Yarn only, with one lockfile | LOW | scan |

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: `package.json`, lockfiles, `.yarnrc.yml`, and the install steps in CI and Docker.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule. `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).
