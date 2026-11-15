# Upgrade <app>: Next.js <from> → <to>

<!-- Report and merge request description for a nextjs-upgrade run. Fill every section; write "none" rather than deleting one.
     For a migrate-mode phase, use the same sections, with the phase's area in the title: "Migrate <app>: <area>". -->

**Mode:** upgrade | upgrade, then the router move | migrate (phase <n>: <area>)
**Package manager:** <yarn | npm | pnpm> (unchanged | converted in phase 1)

## Versions

| | Before | After |
|---|---|---|
| Next.js | <x> | <y> |
| React / react-dom | <x> | <y> |
| @types/react | <x> | <y> |
| Node (`.nvmrc`, `engines`, Dockerfile, CI) | <x> | <y> |
| TypeScript | <x> | <y> |
| ESLint / eslint-config-next | <x> | <y> |

## Checkpoints

| Commit | Major | What changed |
|---|---|---|
| `<sha>` | runtime | Node <y> everywhere, TypeScript <y> |
| `<sha>` | 13 | <codemods run; manual changes> |
| `<sha>` | 14 | |
| `<sha>` | 15 | |
| `<sha>` | 16 | |

**Codemods run:** <list, with the ones the upgrade command ran marked>
**Codemod markers left:** none (`upgrade-codemod-leftovers`)

## Libraries

| Library | Before | After | Why |
|---|---|---|---|
| <name> | <x> | <y> | <peer range of the old release rejected React 19 / Next 16> |

**Replaced (forced, agreed with the user):** <library → library, and why it was forced> or none
**Peer check:** `scripts/peers.sh --next <y> --react <y>`: <n> ok, 0 blocks

## Behaviour that changed on purpose

<Caching decisions (`upgrade-caching-defaults`), image settings (`upgrade-image-defaults`), the bundler choice (`upgrade-bundler-explicit`), edge middleware kept or moved, anything else the guides changed and the app now does differently.>

## Router move (if any)

`scripts/routes.sh` before: pages <n>, app <n>. After: pages 0, app <n>, both 0.
<Routes moved, libraries given their App Router setup, `_app`/`_document`/`i18n` removed.>

## Verification

| Check | Baseline | Now |
|---|---|---|
| Frozen install, typecheck, lint, tests, build | <results, failures that already existed> | <results> |
| Routes (status, redirects, headers) | <n> routes | <same / differences explained> |
| Screenshots | <pages> | <same / differences explained> |
| Sign-in round trip | ok | <ok> |
| Staging: error rate, backend request rate, latency | <numbers> | <numbers> |

`scripts/scan.sh`: <clean / each remaining candidate and why it stays>

## Rollout

- Rollback image: `<registry>/<app>:<previous-tag>`
- Shared caches: <cleared / new prefix / none>
- Release window and who watches it: <when, who>

## Left for later

<Deprecations still in use (with files), new features not switched on (Cache Components, React Compiler, Partial Prefetching), edge middleware kept (with the reason), migrate phases still to come.>
