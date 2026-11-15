# Upgrade mode

The project keeps its stack. Its package manager, router, data, UI, form, i18n, auth and test libraries all stay. What changes: Next, React, their types, `eslint-config-next`, Node, and whatever the crossed majors or a library's support forces. Each such forced change is named in the report (`upgrade-keep-their-stack`).

## Commands with the project's package manager

The project's lockfile decides; never add a second one.

| Step | Yarn (`yarn.lock`) | npm (`package-lock.json`) | pnpm (`pnpm-lock.yaml`) |
|---|---|---|---|
| Latest tag | `yarn npm info next --fields dist-tags` (Yarn 1: `yarn info next dist-tags`) | `npm view next dist-tags` | `pnpm view next dist-tags` |
| Upgrade command | `yarn dlx @next/codemod@<v> upgrade <target>` (Yarn 1: `npx`) | `npx @next/codemod@<v> upgrade <target>` | `pnpm dlx @next/codemod@<v> upgrade <target>` |
| One codemod | `yarn dlx @next/codemod@<v> <transform> .` | `npx @next/codemod@<v> <transform> .` | `pnpm dlx @next/codemod@<v> <transform> .` |
| Install by hand | `yarn add next@<t> react@<r> react-dom@<r>`, `yarn add -D @types/react@<r> @types/react-dom@<r> eslint-config-next@<t>` | `npm install ...` (same packages) | `pnpm add ...` (same packages) |
| Who pins React | `yarn why react` | `npm ls react` | `pnpm why react` |
| Frozen install (verify) | `yarn install --immutable` (Yarn 1: `--frozen-lockfile`) | `npm ci` | `pnpm install --frozen-lockfile` |

`<v>` is a released `@next/codemod` version at least two weeks old. Use the target's version, never `@canary`.

## Steps

1. **Inventory** (`scripts/inventory.sh <app-root>`). From it, note:
   - the router or routers;
   - a custom server (`server.js` calling `next()`), which keeps working but must be checked by hand;
   - `.babelrc` or `babel.config.*`: Turbopack and SWC handle most of what it did (styled-components and emotion through `compiler`), so check what is still needed;
   - `next.config` features: `webpack`, `i18n`, `images`, `rewrites`, `headers`, `output`, `experimental`;
   - middleware;
   - the ESLint config style (`.eslintrc*` or flat);
   - the libraries that pin React or Next.
2. **Baseline** on the current version, before any change:
   - install, typecheck, lint, test, build;
   - save the build's routes table, the test summary and the list of failures that already exist;
   - start the app and save screenshots of the key pages (sign-in, a list, a form, a detail page) and the status codes of the API routes.

   This is what "works as before" means at the end (`upgrade-verify-against-baseline`).
3. **Branch or worktree** from the default branch (`git-worktree`). One merge request for the whole upgrade, with a commit per checkpoint.
4. **Runtime checkpoint:**
   - Node 20.9+ (the current LTS is better) in `.nvmrc` or `.node-version`, `engines.node`, every Dockerfile `FROM node:` and every CI image;
   - TypeScript 5.1+;
   - check the old version still builds on it.

   Commit: `build(<scope>): raise node to <major>`. If the old Next can't build on the new Node, keep this change for the last checkpoint instead.
5. **Install the target** with the upgrade command, or by hand:
   - React 19 for an App Router app (Pages-only: 19 unless a dependency blocks it; 18.2 still works);
   - `@types/react` matching React;
   - `eslint-config-next` matching Next (it needs ESLint 9+ from 16; if the project's ESLint can't move, keep its version and its config, and only replace `next lint`).

   Write down which codemods the command ran.
6. **Checkpoint per crossed major** (`upgrade-checkpoint-per-major`), in order. For each major, open its guide in the installed `node_modules/next/dist/docs/` and its section in [version-path.md](version-path.md). Then:
   1. Run its codemods that weren't run yet.
   2. Make the manual changes for the features the app uses.
   3. Commit: `build(<scope>): apply next <major> changes`.

   Typecheck and build only have to pass after the last major. Note what each checkpoint left broken, so the next one doesn't hide it.
7. **Dependencies:** `bash <this skill>/scripts/peers.sh <app-root> --next <target> --react <react>` lists every dependency whose peer range names React or Next, as `ok`, `blocks` or `check`. Run it before installing the target, then after each library upgrade. For each `blocks`, read the library's changelog and move to the oldest release that supports the target. Common ones: auth (next-auth / Auth.js), i18n (next-i18next, next-intl), data (SWR, React Query), UI kits and CSS-in-JS (MUI, Chakra, styled-components, emotion), `@sentry/nextjs`, next-pwa, next-sitemap, Storybook, testing-library.
   - **Tests:** Enzyme has no React 18 adapter, so moving off it is forced (to Testing Library, on the same runner). `@testing-library/react` needs 13+ for React 18 and 16+ for React 19, with `@testing-library/dom` alongside. `act` comes from `react`. `next/jest` follows the Next version.
   - A library with no supporting release, or one that needs a new major with breaking changes, is the user's decision. Stop and ask with the options; don't swap in a different library.
   - Commit: `build(<scope>): upgrade <lib> for next <target>`.
8. **Codemod leftovers and scan:**
   - resolve every `@next-codemod-error` comment, `UnsafeUnwrapped*` cast and `legacyBehavior` link (`upgrade-codemod-leftovers`);
   - run `bash <this skill>/scripts/scan.sh <app-root>` and confirm or fix each candidate, including the React removals (`upgrade-react-removals`) and the image defaults (`upgrade-image-defaults`);
   - write down the caching intent of each server read and `GET` handler that relied on the old defaults (`upgrade-caching-defaults`).
9. **Verify** against the baseline (`upgrade-verify-against-baseline`):
   - frozen install, typecheck, lint, tests, build;
   - `next start`;
   - the baseline's routes answer the same status codes;
   - screenshots match in the places that matter;
   - images load (the 16 `next/image` defaults);
   - a full sign-in and sign-out round trip;
   - pages that relied on caching still show fresh data;
   - the production image builds and starts with the new Node.
10. **Report,** in the shape of [assets/upgrade-report.md](../assets/upgrade-report.md), which doubles as the merge request description:
    - from and to versions (Next, React, Node, TypeScript, ESLint);
    - the checkpoints;
    - the codemods run;
    - the manual changes per major;
    - each library changed and why;
    - what the baseline comparison showed;
    - anything left for later (new features not switched on, deprecations still in use, such as `legacyBehavior` links or edge middleware).

11. **Roll out** through staging with the previous image ready ([rollout.md](rollout.md), `upgrade-rollout-with-rollback`).

## Then, if asked: the router move

Upgrade mode doesn't move a Pages Router app to the App Router on its own. When the user wants it, it follows the merged upgrade as its own merge request, on the own-stack track of [pages-to-app.md](pages-to-app.md): same libraries, with the App Router setup each one needs ([app-router-libraries.md](app-router-libraries.md)).

## When the direct jump stalls

If the build after the last checkpoint fails and a failure can't be tied to one major, go **stepwise**: reset to the runtime checkpoint and install each major's last release in turn (`next@13.5`, `next@14.2`, `next@15.5`), with that version's React and codemods. Get install, typecheck and build green at each step before the next, then install the target. It is slower, but each red build has one cause.

## Custom server, monorepo, static export

- **Custom server:** check the `next()` options and the request handler against the target's `custom-server` guide. A custom server rules out some features (for example, automatic static optimisation on the Pages Router).
- **Monorepo:** upgrade one app at a time. Shared packages that import `next` move together, and the workspace keeps one version of `react`.
- **Static export:** `output: "export"` stays. Check that the export features it uses still work (image loader, `trailingSlash`, routes needing a server).
