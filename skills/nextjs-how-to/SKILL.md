---
name: nextjs-how-to
description: "Use at the start of any Next.js App Router work when it isn't clear which skill applies, or when a task spans several: starting a new app, building a feature end to end, onboarding to the team's Next.js conventions, asking 'what are our rules for Next.js' or 'how do I review this Next.js change'. Routes to the focused nextjs-* skills (structure, data, BFF, forms, UI, logging, security, end-to-end tests, deploy, package manager, new app, upgrading an old app), go-nextjs-api-contract, the OAuth skills and the vendored Next.js team skills (next-dev-loop for checking an edit in the running dev server, next-bundle-optimizer for bundle audits), says where the team differs from those vendored skills, and lists the few rules every Next.js skill assumes. Each routed skill owns its rules, its review steps and its scan script."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.1.2"
---

# Next.js: which skill to open

**Principle:** Route, don't teach: open the one skill the task needs, and let that skill decide.

This skill only routes. Each skill below is focused on one topic and owns its patterns, its `rules/` (one file per rule, indexed with how each is caught), its "Reviewing" section and, where a script can catch a rule, its `scripts/scan.sh`. Open the one the task needs, and only that one.

**How to use it:** the skills are installed together, each in its own folder beside this one, wherever the project or user keeps skills; the links below are relative to this file, and a skill named in backticks is the folder of that name beside this one. Open the linked `SKILL.md` with Read (they may not be registered as invocable skills), then only the references and rules it points to.

## Pick the skill

| The task | Skill | Rules | Scan |
|---|---|---|---|
| Start a new app with everything below wired in; the enforcement kit (ESLint config, rule tests) | [nextjs-new-app](../nextjs-new-app/SKILL.md) | | |
| Install, add, run, CI or Docker steps; convert off npm/pnpm | [nextjs-package-manager](../nextjs-package-manager/SKILL.md) | `tool-yarn-only` | yes |
| Upgrade an old app (Next 12+) to 16 or the latest release, keeping its stack (upgrade) or moving it onto the team's (migrate); Pages Router to App Router | [nextjs-upgrade](../nextjs-upgrade/SKILL.md) | `upgrade-`, `router-`, `migrate-` | yes |
| Where a file goes; how a page is built; strings; page tests; migrating a tree | [nextjs-app-structure](../nextjs-app-structure/SKILL.md) | `struct-`, `page-`, `i18n-`, `page-test-` | |
| Reading or writing server data (TanStack Query, Server Actions, cache updates); shared client state (Zustand) | [nextjs-data](../nextjs-data/SKILL.md) | `data-`, `action-`, `store-` | yes |
| Browser holds a cookie, the server holds the tokens: session, refresh, reads proxy, `proxy.ts` | [nextjs-bff](../nextjs-bff/SKILL.md) | `bff-` | yes |
| The reply envelope, field errors, OpenAPI and generated types between backend and frontend | [go-nextjs-api-contract](../go-nextjs-api-contract/SKILL.md) | `contract-` | |
| A create, edit, settings or filter form | [nextjs-forms](../nextjs-forms/SKILL.md) | `forms-` | yes |
| Classes, colors, shadcn on Base UI, themes, tables, dialogs, accessibility | [nextjs-ui](../nextjs-ui/SKILL.md) | `ui-` | yes |
| Logging, request ids, error reporting | [nextjs-logging](../nextjs-logging/SKILL.md) | `log-` | yes |
| CSP, security headers, data exposure, uploads, SSRF, dependencies | [nextjs-security](../nextjs-security/SKILL.md) | `sec-`, `deps-` | yes |
| Playwright: sign-in state, backend mocks, screenshots, accessibility scans | [nextjs-e2e](../nextjs-e2e/SKILL.md) | `e2e-` | yes |
| Docker image, one image for every environment, probes, replicas, CI pipeline | [nextjs-deploy](../nextjs-deploy/SKILL.md) | | |
| Signing users in (OAuth client) or running an authorization server | [oauth-client](../oauth-client/SKILL.md), [oauth-server](../oauth-server/SKILL.md) | `sec-oauth-*`, `oauth-` | |
| Check that an edit works in the running `next dev` app (`/_next/mcp` plus a driven browser) | [next-dev-loop](../next-dev-loop/SKILL.md) (vendored, Next.js team; see [Upstream skills](#upstream-skills)) | | |
| Audit or shrink client bundles and initial-load work (`next analyze`) | [next-bundle-optimizer](../next-bundle-optimizer/SKILL.md) (vendored, Next.js team; see [Upstream skills](#upstream-skills)) | | |
| The Go service behind the app | `go-how-to` | | |
| Committing, worktrees, conflicts, ignore files | `git-how-to` | | |
| Merge requests, their pipelines, `.gitlab-ci.yml` | `gitlab-how-to` | | |
| Writing or changing a skill or rule; the rule format; the skills lint | [agent-skills-authoring](../agent-skills-authoring/SKILL.md) | | |

All prefixes, with the few older IDs that keep a prefix from before a split: `agent-skills-authoring` references/rule-prefixes.md.

A task that spans several (a new list page with a create form) loads them in this order: `nextjs-app-structure` → `nextjs-data` → `nextjs-forms` → `nextjs-ui`, then each one's "Reviewing" before calling it done. Which skills review which files:

| Changed | Review with |
|---|---|
| A server action | `nextjs-data`, `nextjs-security` |
| A form | `nextjs-forms` |
| A page or component | `nextjs-ui`, `nextjs-data`, `nextjs-app-structure` |
| A route handler or `src/api/` | `nextjs-bff`, `nextjs-security`, `nextjs-logging` |
| `proxy.ts`, `next.config`, env, CI | `nextjs-security`, `nextjs-deploy` |
| `package.json`, lockfiles, Dockerfile install steps | `nextjs-package-manager` |
| A Next.js or React version upgrade; routes moved from `pages/` to `app/` | `nextjs-upgrade` |
| Playwright specs | `nextjs-e2e` |

## Rules every skill assumes

1. **The project wins.** Its `AGENTS.md`, `CLAUDE.md` and project skills override the team skills where they differ; note the difference rather than "fixing" it. The team skills override the vendored upstream ones ([Upstream skills](#upstream-skills)).
2. **Check the installed version.** Read `node_modules/next/dist/docs/` (and each library's own docs in `node_modules`) before using an API you're unsure of; Next changes conventions between majors.
3. **Yarn 4 only**, pinned by a committed `yarnPath` release; never npm, npx, pnpm or bunx. The one exception is `nextjs-upgrade`'s upgrade mode, which keeps the project's own package manager.
4. **`<app-root>`** is the folder holding the app's `package.json`: the repo root, or the app's own folder in a repo that also holds a backend or other apps (`apps/<app-name>/`); every path in these skills is relative to it.
5. **Server data through TanStack Query and Server Actions**, never `useEffect` + `fetch`; tokens never reach the browser.
6. **Semantic theme tokens and the project's primitives** (`components/shadcn-ui`, Base UI by default) only.
7. **Tests fake the network, not the code**; look at screenshots in light and dark before calling UI work done.
8. **Review before a merge request** with each touched skill's "Reviewing" section, and cite rule IDs in findings.

## Upstream skills

Two task skills from the Next.js repository ([vercel/next.js `skills/`](https://github.com/vercel/next.js/tree/canary/skills)) are vendored unchanged beside the team skills, each with an `UPSTREAM.md` giving its pinned commit: `next-dev-loop` and `next-bundle-optimizer`. They are workflows, not house style, so they don't overlap the `nextjs-*` skills. Follow them, with these differences (the team wins):

1. **Yarn, not pnpm or npm.** Where upstream writes `pnpm exec next ...`, `pnpm next upgrade`, `npx next upgrade` or `pnpm exec node ...`, run `yarn next ...` and `yarn node ...` from `<app-root>` (`nextjs-package-manager`).
2. **Don't install skills.** Upstream's `npx skills add ...` lines aren't run: the team vendors upstream skills beside these ones (`agent-skills-authoring`, "Upstream skills"). The skills they point to (`next-cache-components-*`, `next-partial-prefetching-*`) aren't vendored, because Cache Components and Partial Prefetching are not in use yet; report those candidates instead of acting on them.
3. **`agent-browser` is not in use yet.** `next-dev-loop` needs it on `PATH` (upstream installs it with `npm i -g`). Ask before installing a global tool; until then, use the `/_next/mcp` half of the loop and check the page with the project's screenshot script or Playwright (`nextjs-e2e`).
4. **Versions:** `next-dev-loop` needs Next.js 16.3+ with Turbopack (the `next dev` default since 16). Check the installed version first (rule 2 above).
5. **Temporary files:** upstream writes to `/tmp/`; on Windows use the OS temp folder (`$TMPDIR`, `%TEMP%`), and never inside the repo.
6. **Not a substitute for tests.** The dev loop confirms a change by hand; the page tests, rule tests and Playwright specs still have to pass, and UI work still gets its light and dark screenshots.

## Adding a skill or a rule

A new topic gets its own `nextjs-<topic>` skill and a row in the table above. Rules, prefixes, scan checks, vendoring and the skills lint follow `agent-skills-authoring`.
