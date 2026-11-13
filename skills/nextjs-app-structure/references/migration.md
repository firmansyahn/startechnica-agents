# Adopting the layout in an existing project

1. **Inventory.** Find `<app-root>` (one per app in a monorepo; do one app at a time). List its tree (`find app components src lib utils hooks -maxdepth 2 -type d` from `<app-root>`, skipping `node_modules`), and in a monorepo the `packages/` it depends on. Read `tsconfig.json` paths, `components.json`, the Vitest/Playwright configs and any `AGENTS.md`. An existing `pnpm-workspace.yaml` or `package-lock.json` means the repo isn't on Yarn yet (`nextjs-package-manager` converts it).
2. **Map.** Write a table: current folder → target folder from [folders.md](folders.md), with a reason. Common moves:
   - `lib/` → `src/libs/` (integration) or `src/utils/` (pure, split by the `src/` table's test);
   - top-level `hooks/`, `types/`, `utils/` → `src/`;
   - `components/ui` → `components/shadcn-ui/` (generated primitives only), and hand-written composites found among them → `components/<brand>-ui/`;
   - page-only components in `components/` → beside the page;
   - fetchers in pages → `src/services/<domain>/` (`nextjs-data`).
3. **Confirm with the user** before moving anything when the project has no documented layout, or when the map changes its public import paths. Leave folders the project documents on purpose.
4. **Add aliases first**, keeping the old ones working, so moves don't break imports.
5. **Move one folder kind per commit** (`git mv`, then update imports with the editor's or a codemod's rename, not a blind find-and-replace), running `yarn tsc --noEmit` and the affected tests after each. Use the project's refactoring tooling (a code graph's `rename`, the IDE's move) when it has one.
6. **Remove the old aliases**, add the enforcement test and the `AGENTS.md` section last, once the tree passes it.

Report the map, what moved, and anything left as is (with the reason) at the end.
