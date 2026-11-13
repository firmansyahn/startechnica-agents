# <App name>: web app rules

Binding rules for agents and contributors working in this app. `CLAUDE.md` is just `@AGENTS.md`. The team skills in `.agents/skills/` have the detail; this file names what is specific to this app and wins where it differs.

<!-- Keep the block create-next-app wrote (nextjs-agent-rules): `next dev` re-adds it. -->

## Commands (Yarn only)

Yarn 4 is the release committed in `.yarn/releases` (`yarnPath`). Never use npm, npx or pnpm (`nextjs-package-manager`).

| Task | Command |
|---|---|
| Dev server | `yarn dev` |
| Type check / lint / unit tests | `yarn typecheck`, `yarn lint`, `yarn test` |
| Tests a change reaches | `yarn vitest related --run <file>` |
| End-to-end | `yarn test:e2e` |
| Production build / start | `yarn build`, `yarn start` |
| Add a shadcn primitive | `yarn dlx shadcn@<version> add <name>` (lands in `components/shadcn-ui/`) |

## Layout

`nextjs-app-structure`: routes in `app/`, shared components in `components/` (primitives in `components/shadcn-ui/`, composites in `components/<brand>-ui/`), shared code in `src/<kind>/`, code beside its one route until a second needs it. `tests/src-layout.test.ts` enforces it.

| Folder | Holds |
|---|---|
| `src/services/<domain>/` | Query options and keys (`index.ts`), server actions (`actions.ts`) |
| `src/api/` | Server-only BFF code; `result.ts` is the one client-safe module |
| `src/configs/` | Runtime settings, read per request |
| `src/libs/` | Integration code: logger, `cn()`, build info |
| `src/messages/` | next-intl messages, keys by route |

## Rules

- Reads through `useQuery` on the services registry; writes are server actions returning a `Result`, called through `runAction`. No `useEffect` fetches, no `fetch` in pages (`nextjs-data`).
- Forms: react-hook-form + zod, schema shared with the action (`nextjs-forms`).
- Colors through theme tokens only; Base UI primitives from `components/shadcn-ui` (`nextjs-ui`).
- Every string in every locale file (`src/messages/`).
- Log with `@/libs/logger`, never `console` (`nextjs-logging`).
- Settings come from the environment per request (`src/configs/`); no `NEXT_PUBLIC_*` settings, nothing environment-dependent in `next.config.mjs` (`nextjs-deploy`).
- Review against the team rules (`nextjs-how-to` names the skills; each has a "Reviewing" section); `tests/` holds the rule tests.

## Reference pages

<!-- Name the newest well-tested page of each kind once it exists: list with create/edit, settings, detail. -->
