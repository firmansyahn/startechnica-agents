# Rule ID prefixes across the skills

Every rule lives in the skill that teaches it, as `<skill>/rules/<id>.md`; the file name is the rule ID. IDs are unique across all skills, so each prefix belongs to one skill (a few older IDs keep a prefix from before the split, listed in the owning skill's `rules/_sections.md`).

| Prefix | Skill | Covers |
|---|---|---|
| `ui-` | nextjs-ui | Styling, composition, icons, overlays, states, tables, layout, accessibility |
| `data-`, `data-test-`, `action-`, `store-` | nextjs-data | Queries, mutations, Server Actions, Zustand stores, their tests (`sec-action-*` too) |
| `struct-`, `page-`, `i18n-`, `page-test-` | nextjs-app-structure | Folders, pages, strings, page tests |
| `forms-`, `forms-test-` | nextjs-forms | Fields, validation, edit forms and dialogs, form tests |
| `bff-`, `bff-test-` | nextjs-bff | Session and tokens, the reads proxy, config and `proxy.ts`, BFF tests (`sec-no-tokens-in-browser`, `sec-proxy-*`, `struct-server-only` too) |
| `log-` | nextjs-logging | Logging, redaction, errors |
| `sec-`, `deps-` | nextjs-security | CSP and headers, data and secrets, requests, dependencies (`tool-dependency-audit` too) |
| `e2e-` | nextjs-e2e | Locators, stability, data and auth, visual, scope and CI (`test-e2e-*` too) |
| `contract-`, `contract-doc-`, `contract-test-` | go-nextjs-api-contract | The document, envelope and errors, resources and values, contract tests |
| `sec-oauth-*`, `sec-safe-redirect-next` | oauth-client | OAuth state and PKCE, return-to URLs |
| `oauth-` | oauth-server | The authorization server: flow, tokens, access (resource, scopes, consent), sign-in pages and endpoints |
| `tool-yarn-only` | nextjs-package-manager | Yarn only, one lockfile |
| `upgrade-`, `router-`, `migrate-` | nextjs-upgrade | Crossing Next.js majors (checkpoints, breaking changes, verifying against a baseline); Pages Router to App Router; migrating onto the team's stack in phases |
| `ci-` | gitlab-ci | Workflow rules, per-app rules and variables, org template overrides, manual jobs, triggers, images |
| `mr-` | gitlab-mr | Merging on a green pipeline, stacked MRs, public MRs, reaching GitLab through glab |
| `wt-` | git-worktree | When to make a worktree, its base, its dependencies, removing it safely; splitting parallel work by files, syncing with the base, merge order |
| `commit-` | git-commit | Messages, staging, line endings, `[ci skip]`, author identity |
| `ignore-` | git-gitignore | What is ignored and where, pattern shape, tracked files that match, files never ignored, other ignore files |

Go rules are in the focused `go-<topic>` skills, one prefix each (`layer-` go-project-layout, `style-` go-code-style, `err-` go-error-handling, `conc-` go-concurrency, `db-` go-database, `mongo-` go-mongodb, `redis-` go-redis, `kafka-` go-kafka, `ch-` go-clickhouse, `test-` go-testing, `sec-` go-security, `api-` go-http-handlers, `goci-` go-continuous-integration, `obs-` go-observability); their IDs don't collide with these.

Impact levels and how to raise them: `agent-skills-authoring` ("Impact").
